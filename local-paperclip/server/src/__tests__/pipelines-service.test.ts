import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
  createDb,
  documents,
  documentRevisions,
  executionWorkspaces,
  heartbeatRuns,
  instanceSettings,
  issueComments,
  issues,
  pipelineAutomationExecutions,
  pipelineCaseBlockers,
  pipelineCaseIssueLinks,
  pipelineCaseEvents,
  pipelineCaseDocuments,
  pipelineCases,
  pipelineStages,
  pipelineTransitions,
  pipelines,
  projectWorkspaces,
  projects,
  routineRuns,
  routines,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { pipelineService, type PipelineActor } from "../services/pipelines.ts";
import { routineService } from "../services/routines.ts";
import { instanceSettingsService } from "../services/instance-settings.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres pipeline service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("pipelineService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof pipelineService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  const userActor: PipelineActor = { type: "user", userId: "board-user" };
  const noopHeartbeat = { wakeup: async () => null };

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-pipelines-service-");
    db = createDb(tempDb.connectionString);
    svc = pipelineService(db, { heartbeat: noopHeartbeat });
  }, 20_000);

  afterEach(async () => {
    await db.delete(pipelineAutomationExecutions);
    await db.delete(pipelineCaseBlockers);
    await db.delete(pipelineCaseIssueLinks);
    await db.delete(pipelineCaseEvents);
    await db.delete(pipelineCaseDocuments);
    await db.delete(pipelineCases);
    await db.delete(pipelineTransitions);
    await db.delete(pipelineStages);
    await db.delete(pipelines);
    await db.delete(issueComments);
    await db.delete(activityLog);
    await db.delete(documentRevisions);
    await db.delete(documents);
    await db.delete(routineRuns);
    await db.delete(heartbeatRuns);
    await db.delete(issues);
    await db.delete(executionWorkspaces);
    await db.delete(routines);
    await db.delete(projectWorkspaces);
    await db.delete(projects);
    await db.delete(agents);
    await db.delete(companies);
    await db.delete(instanceSettings);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompany() {
    const [company] = await db.insert(companies).values({
      name: "Pipeline Co",
      issuePrefix: `P${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    }).returning();
    return company!;
  }

  async function seedPipeline(options?: { enforceTransitions?: boolean }) {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: `content-${randomUUID().slice(0, 8)}`,
      name: "Content",
      enforceTransitions: options?.enforceTransitions ?? false,
      actor: userActor,
    });
    const stages = await svc.listStages(company.id, pipeline.id);
    return { company, pipeline, stages, byKey: new Map(stages.map((stage) => [stage.key, stage])) };
  }

  async function seedRoutine(companyId: string, title = "Routine") {
    const [agent] = await db.insert(agents).values({
      companyId,
      name: `${title} Agent`,
      role: "engineer",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    }).returning();
    return routineService(db, { heartbeat: noopHeartbeat }).create(companyId, {
      projectId: null,
      goalId: null,
      parentIssueId: null,
      title,
      description: null,
      assigneeAgentId: agent!.id,
      priority: "medium",
      status: "active",
      concurrencyPolicy: "always_enqueue",
      catchUpPolicy: "skip_missed",
    }, {});
  }

  async function eventCount(caseId: string) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pipelineCaseEvents)
      .where(eq(pipelineCaseEvents.caseId, caseId));
    return count ?? 0;
  }

  async function seedLinkedIssue(input: {
    companyId: string;
    caseId: string;
    role: "origin" | "conversation" | "work" | "automation";
    status?: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled";
    title?: string;
  }) {
    const [issue] = await db.insert(issues).values({
      companyId: input.companyId,
      title: input.title ?? `${input.role} issue`,
      status: input.status ?? "todo",
      priority: "medium",
    }).returning();
    await db.insert(pipelineCaseIssueLinks).values({
      companyId: input.companyId,
      caseId: input.caseId,
      issueId: issue!.id,
      role: input.role,
    });
    return issue!;
  }

  it("seeds default stages and protects non-empty stage deletion", async () => {
    const { company, pipeline, byKey } = await seedPipeline();

    expect([...byKey.keys()]).toEqual(["intake", "in_progress", "review", "done", "cancelled"]);
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "stage-delete",
      title: "Stage delete guard",
      actor: userActor,
    });

    await expect(
      svc.deleteStage({ companyId: company.id, pipelineId: pipeline.id, stageId: byKey.get("intake")!.id }),
    ).rejects.toMatchObject({ status: 422, details: { code: "stage_has_cases" } });

    await svc.deleteStage({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageId: byKey.get("intake")!.id,
      moveCasesToStageId: byKey.get("in_progress")!.id,
    });
    const [moved] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, created.case.id));
    expect(moved!.stageId).toBe(byKey.get("in_progress")!.id);
  });

  it("updates parent terminal counts when deleting a stage moves child cases to done", async () => {
    const { company, pipeline, byKey } = await seedPipeline();
    const parent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "in_progress",
      caseKey: "delete-stage-parent",
      title: "Delete stage parent",
      actor: userActor,
    });
    const child = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "delete-stage-child",
      title: "Delete stage child",
      parentCaseId: parent.case.id,
      actor: userActor,
    });

    await svc.deleteStage({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageId: byKey.get("intake")!.id,
      moveCasesToStageId: byKey.get("done")!.id,
    });

    const [freshParent] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, parent.case.id));
    const [freshChild] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, child.case.id));
    expect(freshParent!.childCount).toBe(1);
    expect(freshParent!.terminalChildCount).toBe(1);
    expect(freshChild!.terminalKind).toBe("done");

    await expect(
      svc.transitionCase({
        companyId: company.id,
        caseId: parent.case.id,
        toStageKey: "done",
        expectedVersion: parent.case.version,
        actor: userActor,
      }),
    ).resolves.toMatchObject({ case: { terminalKind: "done" } });
  });

  it("implements idempotent single and batch ingest", async () => {
    const { company, pipeline } = await seedPipeline();

    const first = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "release-1",
      title: "Release 1",
      actor: userActor,
    });
    const second = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "release-1",
      title: "Duplicate title is ignored",
      actor: userActor,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.case.id).toBe(first.case.id);
    expect(await eventCount(first.case.id)).toBe(1);

    await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "existing-2",
      title: "Existing 2",
      actor: userActor,
    });
    const batch = await svc.ingestCases({
      companyId: company.id,
      pipelineId: pipeline.id,
      actor: userActor,
      items: [
        { caseKey: "new-1", title: "New 1" },
        { caseKey: "new-2", title: "New 2" },
        { caseKey: "release-1", title: "Existing 1" },
        { caseKey: "new-3", title: "New 3" },
        { caseKey: "existing-2", title: "Existing 2 again" },
      ],
    });

    expect(batch).toHaveLength(5);
    expect(batch.filter((item) => item.ok && item.created)).toHaveLength(3);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(pipelineCases);
    expect(count).toBe(5);
  });

  it("enforces conditional breakdown and guarded child-pipeline intake", async () => {
    const company = await seedCompany();
    const topics = await svc.createPipeline({
      companyId: company.id,
      key: "guarded-topic-inventory",
      name: "Guarded topic inventory",
      actor: userActor,
      stages: [
        { key: "candidate", name: "Candidate", kind: "working" },
        { key: "consumed", name: "Consumed", kind: "done" },
        { key: "rejected", name: "Rejected", kind: "cancelled" },
      ],
    });
    const opportunities = await svc.createPipeline({
      companyId: company.id,
      key: "search-demand-opportunities",
      name: "Search demand opportunities",
      actor: userActor,
      stages: [
        {
          key: "action_selected",
          name: "Action selected",
          kind: "working",
          config: {
            breakdown: {
              targetPipelineId: topics.id,
              targetStageKey: "candidate",
              pieceNoun: "topic",
              advanceTo: "delegated",
              whenCaseField: "selectedAction",
              whenCaseFieldEquals: "new_article",
            },
          },
        },
        { key: "delegated", name: "Delegated", kind: "working" },
        { key: "measured", name: "Measured", kind: "done" },
        { key: "rejected", name: "Rejected", kind: "cancelled" },
      ],
    });
    const topicStages = await svc.listStages(company.id, topics.id);
    const topicCandidate = topicStages.find((stage) => stage.key === "candidate")!;
    await svc.updateStage({
      companyId: company.id,
      pipelineId: topics.id,
      stageId: topicCandidate.id,
      patch: {
        config: {
          intakeGuard: {
            requiredParentPipelineId: opportunities.id,
            requiredParentStageKeys: ["action_selected"],
            requiredParentCaseField: "selectedAction",
            requiredParentCaseFieldEquals: "new_article",
          },
        },
      },
      actor: userActor,
    });

    const refresh = await svc.ingestCase({
      companyId: company.id,
      pipelineId: opportunities.id,
      stageKey: "action_selected",
      caseKey: "refresh-opportunity",
      title: "Refresh an existing page",
      fields: { selectedAction: "refresh_existing" },
      actor: userActor,
    });
    await expect(svc.resolveBreakdownTarget({
      companyId: company.id,
      caseId: refresh.case.id,
    })).rejects.toMatchObject({ status: 409, details: { code: "breakdown_condition_not_met" } });
    await expect(svc.ingestCase({
      companyId: company.id,
      pipelineId: topics.id,
      stageKey: "candidate",
      caseKey: "direct-topic",
      title: "Forbidden direct topic",
      parentCaseId: refresh.case.id,
      actor: userActor,
    })).rejects.toMatchObject({ status: 422, details: { code: "intake_parent_field_not_allowed" } });

    const article = await svc.ingestCase({
      companyId: company.id,
      pipelineId: opportunities.id,
      stageKey: "action_selected",
      caseKey: "article-opportunity",
      title: "Create a new article",
      fields: { selectedAction: "new_article" },
      actor: userActor,
    });
    const breakdown = await svc.breakdownCase({
      companyId: company.id,
      caseId: article.case.id,
      items: [{ key: "uncovered-query", title: "Uncovered query" }],
      actor: userActor,
    });

    expect(breakdown.parentCase.stageId).not.toBe(article.case.stageId);
    expect(breakdown.items).toHaveLength(1);
    expect(breakdown.items[0]).toMatchObject({ ok: true, created: true });
  });

  it("blocks a terminal transition until the required pipeline stage inventory reaches its minimum", async () => {
    const company = await seedCompany();
    const topics = await svc.createPipeline({
      companyId: company.id,
      key: "topic-inventory",
      name: "Topic inventory",
      actor: userActor,
      stages: [
        { key: "candidate", name: "Candidate", kind: "working" },
        { key: "ready", name: "Ready", kind: "working" },
        { key: "consumed", name: "Consumed", kind: "done" },
        { key: "rejected", name: "Rejected", kind: "cancelled" },
      ],
    });
    const growth = await svc.createPipeline({
      companyId: company.id,
      key: "growth-actions",
      name: "Growth actions",
      actor: userActor,
      stages: [
        {
          key: "verify",
          name: "Verify",
          kind: "working",
          config: {
            pipelineStageCountRequirements: [{
              toStageKey: "measured",
              pipelineKey: "topic-inventory",
              stageKey: "ready",
              minimumCount: 3,
              activeOnly: true,
              whenCaseField: "actionType",
              whenCaseFieldEquals: "topic_inventory_refill",
            }],
          },
        },
        { key: "measured", name: "Measured", kind: "done" },
        { key: "rejected", name: "Rejected", kind: "cancelled" },
      ],
    });

    for (const topicKey of ["ready-a", "ready-b"]) {
      await svc.ingestCase({
        companyId: company.id,
        pipelineId: topics.id,
        stageKey: "ready",
        caseKey: topicKey,
        title: topicKey,
        actor: userActor,
      });
    }
    const refill = await svc.ingestCase({
      companyId: company.id,
      pipelineId: growth.id,
      stageKey: "verify",
      caseKey: "refill",
      title: "Refill topics",
      fields: { actionType: "topic_inventory_refill" },
      actor: userActor,
    });

    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: refill.case.id,
      toStageKey: "measured",
      expectedVersion: refill.case.version,
      actor: userActor,
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pipeline_stage_count_below_minimum",
        minimumCount: 3,
        actualCount: 2,
      },
    });

    await svc.ingestCase({
      companyId: company.id,
      pipelineId: topics.id,
      stageKey: "ready",
      caseKey: "ready-c",
      title: "ready-c",
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: refill.case.id,
      toStageKey: "measured",
      expectedVersion: refill.case.version,
      actor: userActor,
    })).resolves.toMatchObject({ case: { terminalKind: "done" } });
  });

  it("counts multiple eligible stages and enforces per-field inventory quotas", async () => {
    const company = await seedCompany();
    const topics = await svc.createPipeline({
      companyId: company.id,
      key: "segmented-topic-inventory",
      name: "Segmented topic inventory",
      actor: userActor,
      stages: [
        { key: "ready", name: "Ready", kind: "working" },
        { key: "reserved", name: "Reserved", kind: "working" },
        { key: "consumed", name: "Consumed", kind: "done" },
        { key: "rejected", name: "Rejected", kind: "cancelled" },
      ],
    });
    const growth = await svc.createPipeline({
      companyId: company.id,
      key: "segmented-growth-actions",
      name: "Segmented growth actions",
      actor: userActor,
      stages: [
        {
          key: "verify",
          name: "Verify",
          kind: "working",
          config: {
            pipelineStageCountRequirements: [{
              toStageKey: "measured",
              pipelineKey: "segmented-topic-inventory",
              stageKey: "ready",
              additionalStageKeys: ["reserved"],
              minimumCount: 5,
              groupByField: "primaryAudienceSegmentId",
              requiredGroupValues: ["segment-a", "segment-b"],
              minimumCountByGroup: { "segment-a": 3, "segment-b": 2 },
              activeOnly: true,
              whenCaseField: "actionType",
              whenCaseFieldEquals: "topic_inventory_refill",
            }],
          },
        },
        { key: "measured", name: "Measured", kind: "done" },
        { key: "rejected", name: "Rejected", kind: "cancelled" },
      ],
    });

    for (const [topicKey, stageKey, segment] of [
      ["a-ready", "ready", "segment-a"],
      ["a-reserved", "reserved", "segment-a"],
      ["a-extra", "ready", "segment-a"],
      ["b-ready", "ready", "segment-b"],
    ] as const) {
      await svc.ingestCase({
        companyId: company.id,
        pipelineId: topics.id,
        stageKey,
        caseKey: topicKey,
        title: topicKey,
        fields: { primaryAudienceSegmentId: segment },
        actor: userActor,
      });
    }
    const refill = await svc.ingestCase({
      companyId: company.id,
      pipelineId: growth.id,
      stageKey: "verify",
      caseKey: "segmented-refill",
      title: "Refill segmented topics",
      fields: { actionType: "topic_inventory_refill" },
      actor: userActor,
    });

    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: refill.case.id,
      toStageKey: "measured",
      expectedVersion: refill.case.version,
      actor: userActor,
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pipeline_stage_group_quota_below_minimum",
        groupByField: "primaryAudienceSegmentId",
        deficits: [{ value: "segment-b", actualCount: 1, minimumCount: 2 }],
      },
    });

    await svc.ingestCase({
      companyId: company.id,
      pipelineId: topics.id,
      stageKey: "reserved",
      caseKey: "b-reserved",
      title: "b-reserved",
      fields: { primaryAudienceSegmentId: "segment-b" },
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: refill.case.id,
      toStageKey: "measured",
      expectedVersion: refill.case.version,
      actor: userActor,
    })).resolves.toMatchObject({ case: { terminalKind: "done" } });
  });

  it("blocks a transition until its required case fields are present", async () => {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "clustered-search-demand",
      name: "Clustered search demand",
      actor: userActor,
      stages: [
        {
          key: "discovered",
          name: "Discovered",
          kind: "working",
          config: {
            transitionFieldRequirements: [{
              toStageKey: "evidence_ready",
              requiredFields: ["intentClusterKey", "supportingQueries"],
            }],
          },
        },
        { key: "evidence_ready", name: "Evidence Ready", kind: "working" },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "discovered",
      caseKey: "return-to-ukraine",
      title: "Return to Ukraine",
      fields: { supportingQueries: [] },
      actor: userActor,
    });

    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "evidence_ready",
      expectedVersion: created.case.version,
      actor: userActor,
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pipeline_case_required_fields_missing",
        missingFields: ["intentClusterKey"],
      },
    });

    const updated = await svc.patchCaseContent({
      companyId: company.id,
      caseId: created.case.id,
      expectedVersion: created.case.version,
      fieldPatch: { intentClusterKey: "life-decisions:return-or-stay" },
      actor: userActor,
    });
    const evidenceReadyStage = (await svc.listStages(company.id, pipeline.id))
      .find((stage) => stage.key === "evidence_ready");
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "evidence_ready",
      expectedVersion: updated.version,
      actor: userActor,
    })).resolves.toMatchObject({ case: { stageId: evidenceReadyStage?.id } });
  });

  it("conditionally enforces required fields and exact array lengths", async () => {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "curriculum-topics",
      name: "Curriculum topics",
      actor: userActor,
      stages: [
        {
          key: "candidate",
          name: "Candidate",
          kind: "working",
          config: {
            transitionFieldRequirements: [{
              toStageKey: "ready",
              requiredFields: ["primaryConceptKey", "introducedConceptKeys", "curriculumGateStatus"],
              requiredArrayLengths: { introducedConceptKeys: 1 },
              requiredFieldValues: { curriculumGateStatus: "passed" },
              singleItemArrayMatchesField: { introducedConceptKeys: "primaryConceptKey" },
              whenCaseField: "contentPortfolioTrack",
              whenCaseFieldEquals: "western_astrology_learning",
            }],
          },
        },
        { key: "ready", name: "Ready", kind: "working" },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "candidate",
      caseKey: "aspects",
      title: "Aspects",
      fields: {
        contentPortfolioTrack: "western_astrology_learning",
        primaryConceptKey: "aspect",
        introducedConceptKeys: ["aspect", "house"],
        curriculumGateStatus: "passed",
      },
      actor: userActor,
    });

    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "ready",
      expectedVersion: created.case.version,
      actor: userActor,
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pipeline_case_required_array_length_mismatch",
        invalidArrayLengths: [{ key: "introducedConceptKeys", expectedLength: 1, actualLength: 2 }],
      },
    });

    const updated = await svc.patchCaseContent({
      companyId: company.id,
      caseId: created.case.id,
      expectedVersion: created.case.version,
      fieldPatch: { introducedConceptKeys: ["aspect"] },
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "ready",
      expectedVersion: updated.version,
      actor: userActor,
    })).resolves.toMatchObject({ case: { terminalKind: null } });

    const wrongStatus = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "candidate",
      caseKey: "house",
      title: "House",
      fields: {
        contentPortfolioTrack: "western_astrology_learning",
        primaryConceptKey: "house",
        introducedConceptKeys: ["house"],
        curriculumGateStatus: "failed",
      },
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: wrongStatus.case.id,
      toStageKey: "ready",
      expectedVersion: wrongStatus.case.version,
      actor: userActor,
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pipeline_case_required_field_value_mismatch",
      },
    });

    const wrongConcept = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "candidate",
      caseKey: "planet",
      title: "Planet",
      fields: {
        contentPortfolioTrack: "western_astrology_learning",
        primaryConceptKey: "planet",
        introducedConceptKeys: ["house"],
        curriculumGateStatus: "passed",
      },
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: wrongConcept.case.id,
      toStageKey: "ready",
      expectedVersion: wrongConcept.case.version,
      actor: userActor,
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "pipeline_case_single_item_array_field_mismatch",
      },
    });

    const nonCurriculum = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "candidate",
      caseKey: "trend",
      title: "Trend",
      fields: { contentPortfolioTrack: "audience_trends" },
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: nonCurriculum.case.id,
      toStageKey: "ready",
      expectedVersion: nonCurriculum.case.version,
      actor: userActor,
    })).resolves.toMatchObject({ case: { terminalKind: null } });
  });

  it("persists workspaceRef during ingest", async () => {
    const { company, pipeline } = await seedPipeline();
    const workspaceRef = {
      workspacePath: "exports/pipeline-case",
      name: "Pipeline case files",
    };

    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "workspace-ref",
      title: "Workspace ref",
      workspaceRef,
      actor: userActor,
    });

    expect(created.case.workspaceRef).toEqual(workspaceRef);
    const [stored] = await db
      .select({ workspaceRef: pipelineCases.workspaceRef })
      .from(pipelineCases)
      .where(eq(pipelineCases.id, created.case.id));
    expect(stored?.workspaceRef).toEqual(workspaceRef);
  });

  it("rejects stale content PATCH without writing an event", async () => {
    const { company, pipeline } = await seedPipeline();
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "patch",
      title: "Patch me",
      actor: userActor,
    });
    await svc.patchCaseContent({
      companyId: company.id,
      caseId: created.case.id,
      title: "Patched",
      expectedVersion: 1,
      actor: userActor,
    });
    const before = await eventCount(created.case.id);

    await expect(
      svc.patchCaseContent({
        companyId: company.id,
        caseId: created.case.id,
        title: "Stale",
        expectedVersion: 1,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 409, details: { code: "version_conflict", version: 2 } });
    expect(await eventCount(created.case.id)).toBe(before);
  });

  it("merges fieldPatch without erasing existing case evidence", async () => {
    const { company, pipeline } = await seedPipeline();
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "field-patch",
      title: "Field patch",
      fields: { titleUk: "Збережена тема", evidenceStatus: "ready", attempt: 1 },
      actor: userActor,
    });

    const patched = await svc.patchCaseContent({
      companyId: company.id,
      caseId: created.case.id,
      fieldPatch: { attempt: 2, remoteRunId: "run-1" },
      expectedVersion: 1,
      actor: userActor,
    });

    expect(patched.version).toBe(2);
    expect(patched.fields).toEqual({
      titleUk: "Збережена тема",
      evidenceStatus: "ready",
      attempt: 2,
      remoteRunId: "run-1",
    });
  });

  it("rejects fields and fieldPatch in the same service mutation", async () => {
    const { company, pipeline } = await seedPipeline();
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "field-patch-conflict",
      title: "Field patch conflict",
      fields: { preserved: true },
      actor: userActor,
    });

    await expect(svc.patchCaseContent({
      companyId: company.id,
      caseId: created.case.id,
      fields: { replacement: true },
      fieldPatch: { merged: true },
      expectedVersion: 1,
      actor: userActor,
    })).rejects.toMatchObject({ status: 422, details: { code: "validation" } });
  });

  it("lets exactly one parallel transition with the same expectedVersion succeed", async () => {
    const { company, pipeline } = await seedPipeline();
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "parallel",
      title: "Parallel transition",
      actor: userActor,
    });

    const attempts = await Promise.allSettled([
      svc.transitionCase({
        companyId: company.id,
        caseId: created.case.id,
        toStageKey: "in_progress",
        expectedVersion: 1,
        actor: userActor,
      }),
      svc.transitionCase({
        companyId: company.id,
        caseId: created.case.id,
        toStageKey: "review",
        expectedVersion: 1,
        actor: userActor,
      }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    const [row] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, created.case.id));
    expect(row!.version).toBe(2);
    expect(await eventCount(created.case.id)).toBe(2);
  });

  it("enforces active leases and lets the holder transition with the lease token", async () => {
    const { company, pipeline } = await seedPipeline();
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "lease",
      title: "Leased case",
      actor: userActor,
    });
    const owner: PipelineActor = { type: "user", userId: "owner" };
    const other: PipelineActor = { type: "user", userId: "other" };

    const claimed = await svc.claimCase({ companyId: company.id, caseId: created.case.id, actor: owner });
    await expect(svc.claimCase({ companyId: company.id, caseId: created.case.id, actor: other })).rejects.toMatchObject({
      status: 409,
      details: { code: "lease_held" },
    });
    await expect(
      svc.transitionCase({
        companyId: company.id,
        caseId: created.case.id,
        toStageKey: "in_progress",
        expectedVersion: 1,
        actor: other,
      }),
    ).rejects.toMatchObject({ status: 409, details: { code: "lease_held" } });

    const transitioned = await svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "in_progress",
      expectedVersion: 1,
      leaseToken: claimed.leaseToken,
      actor: owner,
    });
    expect(transitioned.case.version).toBe(2);
    expect(await eventCount(created.case.id)).toBe(3);
  });

  it("expires leases on read before a new claim", async () => {
    const { company, pipeline } = await seedPipeline();
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "expired-lease",
      title: "Expired lease",
      actor: userActor,
    });
    await db.update(pipelineCases).set({
      leaseOwnerType: "user",
      leaseUserId: "old-owner",
      leaseToken: randomUUID(),
      leaseExpiresAt: new Date(Date.now() - 5_000),
    }).where(eq(pipelineCases.id, created.case.id));

    const claimed = await svc.claimCase({ companyId: company.id, caseId: created.case.id, actor: { type: "user", userId: "new-owner" } });

    expect(claimed.leaseUserId).toBe("new-owner");
    const events = await svc.listCaseEvents(company.id, created.case.id);
    expect(events.map((event) => event.type)).toEqual(["ingested", "lease_expired", "claimed"]);
  });

  it("enforces transition edges only when enforceTransitions is enabled", async () => {
    const { company, pipeline } = await seedPipeline({ enforceTransitions: true });
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "edges",
      title: "Transition edges",
      actor: userActor,
    });

    await expect(
      svc.transitionCase({
        companyId: company.id,
        caseId: created.case.id,
        toStageKey: "done",
        expectedVersion: 1,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 409, details: { code: "transition_not_allowed" } });

    await db.update(pipelines).set({ enforceTransitions: false }).where(eq(pipelines.id, pipeline.id));
    const moved = await svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "done",
      expectedVersion: 1,
      actor: userActor,
    });
    expect(moved.case.terminalKind).toBe("done");
  });

  it("rejects a self-transition even when edge enforcement is disabled", async () => {
    const { company, pipeline } = await seedPipeline({ enforceTransitions: false });
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "self-transition",
      title: "Self transition",
      actor: userActor,
    });

    await expect(
      svc.transitionCase({
        companyId: company.id,
        caseId: created.case.id,
        toStageKey: "intake",
        expectedVersion: created.case.version,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 422, details: { code: "self_transition_not_allowed" } });
  });

  it("preserves an editorial approval across declared post-review delivery evidence only", async () => {
    const { company, pipeline, byKey } = await seedPipeline();
    const delivery = await svc.createStage({
      companyId: company.id,
      pipelineId: pipeline.id,
      key: "delivery",
      name: "Delivery",
      kind: "working",
      position: 400,
      config: { reviewSafeFieldKeys: ["deliveryProof"] },
      actor: userActor,
    });
    await svc.updateStage({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageId: byKey.get("review")!.id,
      patch: {
        config: {
          ...(byKey.get("review")!.config as Record<string, unknown>),
          approveToStageKey: "delivery",
        },
      },
      actor: userActor,
    });

    const safeCase = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "review-safe-delivery",
      title: "Review-safe delivery",
      actor: userActor,
    });
    await svc.transitionCase({
      companyId: company.id,
      caseId: safeCase.case.id,
      toStageKey: "review",
      expectedVersion: 1,
      actor: userActor,
    });
    const approved = await svc.reviewCase({
      companyId: company.id,
      caseId: safeCase.case.id,
      decision: "approve",
      expectedVersion: 2,
      actor: userActor,
    });
    expect(approved.case.stageId).toBe(delivery.id);
    const proofWritten = await svc.patchCaseContent({
      companyId: company.id,
      caseId: safeCase.case.id,
      fields: { deliveryProof: { messageId: "telegram-1" } },
      expectedVersion: approved.case.version,
      actor: userActor,
    });
    const safeEvents = await svc.listCaseEvents(company.id, safeCase.case.id);
    const proofEvent = safeEvents.find((event) => event.type === "updated");
    expect((proofEvent!.payload as Record<string, unknown>).reviewMaterialChanged).toBe(false);
    // A stricter policy can be deployed after an operational event was already
    // recorded. Its explicit changed-field allowlist must still unblock recovery.
    await db.update(pipelineCaseEvents)
      .set({
        payload: {
          ...(proofEvent!.payload as Record<string, unknown>),
          reviewMaterialChanged: true,
        },
      })
      .where(eq(pipelineCaseEvents.id, proofEvent!.id));
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: safeCase.case.id,
      toStageKey: "done",
      expectedVersion: proofWritten.version,
      actor: userActor,
    })).resolves.toMatchObject({ case: { terminalKind: "done" } });

    const unsafeCase = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "review-unsafe-delivery",
      title: "Review-unsafe delivery",
      actor: userActor,
    });
    await svc.transitionCase({
      companyId: company.id,
      caseId: unsafeCase.case.id,
      toStageKey: "review",
      expectedVersion: 1,
      actor: userActor,
    });
    const unsafeApproval = await svc.reviewCase({
      companyId: company.id,
      caseId: unsafeCase.case.id,
      decision: "approve",
      expectedVersion: 2,
      actor: userActor,
    });
    const unsafeUpdate = await svc.patchCaseContent({
      companyId: company.id,
      caseId: unsafeCase.case.id,
      fields: { deliveryProof: { messageId: "telegram-2" }, rewrittenBody: "changed after review" },
      expectedVersion: unsafeApproval.case.version,
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: unsafeCase.case.id,
      toStageKey: "done",
      expectedVersion: unsafeUpdate.version,
      actor: userActor,
    })).rejects.toMatchObject({ status: 409, details: { code: "review_outdated" } });
  });

  it("blocks transitions while blockers are not done", async () => {
    const { company, pipeline } = await seedPipeline();
    const blocked = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "blocked",
      title: "Blocked case",
      actor: userActor,
    });
    const blocker = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "blocker",
      title: "Blocking case",
      actor: userActor,
    });
    await svc.replaceBlockers({
      companyId: company.id,
      caseId: blocked.case.id,
      blockedByCaseIds: [blocker.case.id],
      actor: userActor,
    });

    await expect(
      svc.transitionCase({
        companyId: company.id,
        caseId: blocked.case.id,
        toStageKey: "in_progress",
        expectedVersion: 1,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 409, details: { code: "blocked" } });

    const reviewMove = await svc.transitionCase({
      companyId: company.id,
      caseId: blocked.case.id,
      toStageKey: "review",
      expectedVersion: 1,
      actor: userActor,
    });
    expect(reviewMove.case.version).toBe(2);

    await expect(
      svc.transitionCase({
        companyId: company.id,
        caseId: blocked.case.id,
        toStageKey: "done",
        expectedVersion: 2,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 409, details: { code: "blocked" } });

    await svc.transitionCase({
      companyId: company.id,
      caseId: blocker.case.id,
      toStageKey: "done",
      expectedVersion: 1,
      actor: userActor,
    });
    const moved = await svc.transitionCase({
      companyId: company.id,
      caseId: blocked.case.id,
      toStageKey: "in_progress",
      expectedVersion: 2,
      actor: userActor,
    });
    expect(moved.case.version).toBe(3);
    const events = await svc.listCaseEvents(company.id, blocked.case.id);
    expect(events.map((event) => event.type)).toContain("blockers_resolved");
  });

  it("emits blockers_resolved once for each fresh blocker set", async () => {
    const { company, pipeline } = await seedPipeline();
    const blocked = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "blocked-again",
      title: "Blocked again",
      actor: userActor,
    });
    const firstBlocker = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "first-blocker",
      title: "First blocker",
      actor: userActor,
    });
    const secondBlocker = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "second-blocker",
      title: "Second blocker",
      actor: userActor,
    });
    const workIssue = await seedLinkedIssue({
      companyId: company.id,
      caseId: blocked.case.id,
      role: "work",
      title: "Blocked work",
    });

    await svc.replaceBlockers({
      companyId: company.id,
      caseId: blocked.case.id,
      blockedByCaseIds: [firstBlocker.case.id],
      actor: userActor,
    });
    await svc.transitionCase({
      companyId: company.id,
      caseId: firstBlocker.case.id,
      toStageKey: "done",
      expectedVersion: 1,
      actor: userActor,
    });

    await svc.replaceBlockers({
      companyId: company.id,
      caseId: blocked.case.id,
      blockedByCaseIds: [secondBlocker.case.id],
      actor: userActor,
    });
    await svc.transitionCase({
      companyId: company.id,
      caseId: secondBlocker.case.id,
      toStageKey: "done",
      expectedVersion: 1,
      actor: userActor,
    });

    const events = await svc.listCaseEvents(company.id, blocked.case.id);
    expect(events.filter((event) => event.type === "blockers_resolved")).toHaveLength(2);
    const comments = await db.select().from(issueComments).where(eq(issueComments.issueId, workIssue.id));
    expect(comments).toHaveLength(2);
    expect(comments.map((comment) => comment.body).join("\n")).toContain(firstBlocker.case.id);
    expect(comments.map((comment) => comment.body).join("\n")).toContain(secondBlocker.case.id);
  });

  it("keeps cancelled blockers unsatisfied until replaced", async () => {
    const { company, pipeline } = await seedPipeline();
    const blocked = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "blocked-cancelled",
      title: "Blocked case",
      actor: userActor,
    });
    const blocker = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "blocker-cancelled",
      title: "Cancelled blocker",
      actor: userActor,
    });
    await svc.replaceBlockers({
      companyId: company.id,
      caseId: blocked.case.id,
      blockedByCaseIds: [blocker.case.id],
      actor: userActor,
    });
    await svc.transitionCase({
      companyId: company.id,
      caseId: blocker.case.id,
      toStageKey: "cancelled",
      expectedVersion: 1,
      actor: userActor,
    });

    await expect(
      svc.transitionCase({
        companyId: company.id,
        caseId: blocked.case.id,
        toStageKey: "in_progress",
        expectedVersion: 1,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 409, details: { code: "blocked" } });

    await svc.replaceBlockers({ companyId: company.id, caseId: blocked.case.id, blockedByCaseIds: [], actor: userActor });
    const moved = await svc.transitionCase({
      companyId: company.id,
      caseId: blocked.case.id,
      toStageKey: "in_progress",
      expectedVersion: 1,
      actor: userActor,
    });
    expect(moved.case.version).toBe(2);
  });

  it("posts upstream drift notices to active dependent work issues only", async () => {
    const { company, pipeline } = await seedPipeline();
    const upstream = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "draft",
      title: "Draft",
      actor: userActor,
    });
    const workDependent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "asset-work",
      title: "Asset work",
      blockedByCaseIds: [upstream.case.id],
      actor: userActor,
    });
    const conversationDependent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "asset-conversation",
      title: "Asset conversation",
      blockedByCaseIds: [upstream.case.id],
      actor: userActor,
    });
    const workIssue = await seedLinkedIssue({
      companyId: company.id,
      caseId: workDependent.case.id,
      role: "work",
      title: "Asset work issue",
    });
    const conversationIssue = await seedLinkedIssue({
      companyId: company.id,
      caseId: conversationDependent.case.id,
      role: "conversation",
      title: "Conversation issue",
    });

    const updated = await svc.patchCaseContent({
      companyId: company.id,
      caseId: upstream.case.id,
      title: "Draft v2",
      expectedVersion: 1,
      actor: userActor,
    });

    expect(updated.version).toBe(2);
    const workComments = await db.select().from(issueComments).where(eq(issueComments.issueId, workIssue.id));
    expect(workComments).toHaveLength(1);
    expect(workComments[0]!.authorType).toBe("system");
    expect(workComments[0]!.body).toBe(
      `Upstream case [draft](/PAP/pipelines/${pipeline.id}/cases/${upstream.case.id}) changed (v1→v2).`,
    );
    const conversationComments = await db.select().from(issueComments).where(eq(issueComments.issueId, conversationIssue.id));
    expect(conversationComments).toHaveLength(0);
  });

  it("skips upstream drift notices for terminal dependents and dependents without work issues", async () => {
    const { company, pipeline } = await seedPipeline();
    const upstream = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "source",
      title: "Source",
      actor: userActor,
    });
    const terminalDependent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "done",
      caseKey: "terminal-dependent",
      title: "Terminal dependent",
      actor: userActor,
    });
    await svc.replaceBlockers({
      companyId: company.id,
      caseId: terminalDependent.case.id,
      blockedByCaseIds: [upstream.case.id],
      actor: userActor,
    });
    const noWorkDependent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "no-work-dependent",
      title: "No work dependent",
      blockedByCaseIds: [upstream.case.id],
      actor: userActor,
    });
    const terminalIssue = await seedLinkedIssue({
      companyId: company.id,
      caseId: terminalDependent.case.id,
      role: "work",
      title: "Terminal work issue",
    });
    const conversationIssue = await seedLinkedIssue({
      companyId: company.id,
      caseId: noWorkDependent.case.id,
      role: "conversation",
      title: "Non-work issue",
    });

    await svc.patchCaseContent({
      companyId: company.id,
      caseId: upstream.case.id,
      summary: "Updated source",
      expectedVersion: 1,
      actor: userActor,
    });

    const terminalComments = await db.select().from(issueComments).where(eq(issueComments.issueId, terminalIssue.id));
    expect(terminalComments).toHaveLength(0);
    const conversationComments = await db.select().from(issueComments).where(eq(issueComments.issueId, conversationIssue.id));
    expect(conversationComments).toHaveLength(0);
  });

  it("does not bump versions or notify dependents on no-op content patches", async () => {
    const { company, pipeline } = await seedPipeline();
    const upstream = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "noop-source",
      title: "No-op source",
      fields: { channel: "blog" },
      actor: userActor,
    });
    const dependent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "noop-dependent",
      title: "No-op dependent",
      blockedByCaseIds: [upstream.case.id],
      actor: userActor,
    });
    const workIssue = await seedLinkedIssue({
      companyId: company.id,
      caseId: dependent.case.id,
      role: "work",
      title: "No-op work issue",
    });
    const beforeEvents = await eventCount(upstream.case.id);

    const patched = await svc.patchCaseContent({
      companyId: company.id,
      caseId: upstream.case.id,
      title: "No-op source",
      fields: { channel: "blog" },
      expectedVersion: 1,
      actor: userActor,
    });

    expect(patched.version).toBe(1);
    expect(await eventCount(upstream.case.id)).toBe(beforeEvents);
    const comments = await db.select().from(issueComments).where(eq(issueComments.issueId, workIssue.id));
    expect(comments).toHaveLength(0);
  });

  it("resolves in-batch forward blocker case keys", async () => {
    const { company, pipeline } = await seedPipeline();

    const results = await svc.ingestCases({
      companyId: company.id,
      pipelineId: pipeline.id,
      items: [
        { caseKey: "tweet", title: "Tweet", blockedByCaseKeys: ["image", "post"] },
        { caseKey: "image", title: "Image" },
        { caseKey: "post", title: "Post" },
      ],
      actor: userActor,
    });

    expect(results.map((result) => result.ok)).toEqual([true, true, true]);
    const successful = results.filter((result): result is Extract<(typeof results)[number], { ok: true }> => result.ok);
    const byKey = new Map(successful
      .map((result) => [result.case.caseKey, result.case.id]));
    const blockers = await db
      .select()
      .from(pipelineCaseBlockers)
      .where(eq(pipelineCaseBlockers.caseId, byKey.get("tweet")!));
    expect(blockers.map((row) => row.blockedByCaseId).sort()).toEqual([
      byKey.get("image")!,
      byKey.get("post")!,
    ].sort());
    const events = await svc.listCaseEvents(company.id, byKey.get("tweet")!);
    const blockersEvent = events.find((event) => event.type === "blockers_set");
    expect(blockersEvent?.payload).toMatchObject({
      blockedByCaseIds: expect.arrayContaining([byKey.get("image")!, byKey.get("post")!]),
      blockedByCaseKeys: ["image", "post"],
    });
  });

  it("resolves blocker case keys against existing cases", async () => {
    const { company, pipeline } = await seedPipeline();
    const asset = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "asset",
      title: "Asset",
      actor: userActor,
    });

    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "tweet",
      title: "Tweet",
      blockedByCaseKeys: ["asset"],
      actor: userActor,
    });

    const blockers = await db
      .select()
      .from(pipelineCaseBlockers)
      .where(eq(pipelineCaseBlockers.caseId, created.case.id));
    expect(blockers.map((row) => row.blockedByCaseId)).toEqual([asset.case.id]);
  });

  it("fails only unresolved blocker-key rows in batch ingest", async () => {
    const { company, pipeline } = await seedPipeline();

    const results = await svc.ingestCases({
      companyId: company.id,
      pipelineId: pipeline.id,
      items: [
        { caseKey: "ok", title: "OK" },
        { caseKey: "missing", title: "Missing", blockedByCaseKeys: ["does-not-exist"] },
        { caseKey: "after", title: "After" },
      ],
      actor: userActor,
    });

    expect(results[0]).toMatchObject({ ok: true });
    expect(results[1]).toMatchObject({
      ok: false,
      caseKey: "missing",
      error: {
        status: 404,
        details: { code: "blocker_case_key_not_found", missingCaseKeys: ["does-not-exist"] },
      },
    });
    expect(results[2]).toMatchObject({ ok: true });
    const rows = await db.select().from(pipelineCases).where(eq(pipelineCases.pipelineId, pipeline.id));
    expect(rows.map((row) => row.caseKey).sort()).toEqual(["after", "ok"]);
  });

  it("rejects blocker cycles declared by batch case keys", async () => {
    const { company, pipeline } = await seedPipeline();

    const results = await svc.ingestCases({
      companyId: company.id,
      pipelineId: pipeline.id,
      items: [
        { caseKey: "a", title: "A", blockedByCaseKeys: ["b"] },
        { caseKey: "b", title: "B", blockedByCaseKeys: ["a"] },
      ],
      actor: userActor,
    });

    expect(results).toEqual([
      expect.objectContaining({
        ok: false,
        caseKey: "a",
        error: expect.objectContaining({ status: 409, details: { code: "blocker_cycle", blockedByCaseKeys: ["b"] } }),
      }),
      expect.objectContaining({
        ok: false,
        caseKey: "b",
        error: expect.objectContaining({ status: 409, details: { code: "blocker_cycle", blockedByCaseKeys: ["a"] } }),
      }),
    ]);
    const rows = await db.select().from(pipelineCases).where(eq(pipelineCases.pipelineId, pipeline.id));
    expect(rows).toHaveLength(0);
  });

  it("rejects parent and blocker cycles and enforces parent depth", async () => {
    const { company, pipeline } = await seedPipeline();
    const a = await svc.ingestCase({ companyId: company.id, pipelineId: pipeline.id, caseKey: "a", title: "A", actor: userActor });
    const b = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "b",
      title: "B",
      parentCaseId: a.case.id,
      actor: userActor,
    });

    await expect(
      svc.patchCaseContent({
        companyId: company.id,
        caseId: a.case.id,
        parentCaseId: b.case.id,
        expectedVersion: 1,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 409, details: { code: "parent_cycle" } });

    await svc.replaceBlockers({ companyId: company.id, caseId: a.case.id, blockedByCaseIds: [b.case.id], actor: userActor });
    await expect(
      svc.replaceBlockers({ companyId: company.id, caseId: b.case.id, blockedByCaseIds: [a.case.id], actor: userActor }),
    ).rejects.toMatchObject({ status: 409, details: { code: "blocker_cycle" } });

    let parentCaseId: string | null = null;
    for (let index = 0; index < 32; index += 1) {
      const created = await svc.ingestCase({
        companyId: company.id,
        pipelineId: pipeline.id,
        caseKey: `chain-${index}`,
        title: `Chain ${index}`,
        parentCaseId,
        actor: userActor,
      });
      parentCaseId = created.case.id;
    }
    await expect(
      svc.ingestCase({
        companyId: company.id,
        pipelineId: pipeline.id,
        caseKey: "too-deep",
        title: "Too deep",
        parentCaseId,
        actor: userActor,
      }),
    ).rejects.toMatchObject({ status: 422, details: { code: "parent_depth_exceeded" } });
  });

  it("rolls up a three-level tree, updates counters, and emits children_terminal once", async () => {
    const { company, pipeline } = await seedPipeline();
    const root = await svc.ingestCase({ companyId: company.id, pipelineId: pipeline.id, caseKey: "root", title: "Root", actor: userActor });
    const [linkedIssue] = await db.insert(issues).values({
      companyId: company.id,
      title: "Root conversation",
      status: "todo",
      priority: "medium",
    }).returning();
    await db.insert(pipelineCaseIssueLinks).values({
      companyId: company.id,
      caseId: root.case.id,
      issueId: linkedIssue!.id,
      role: "conversation",
    });
    const childA = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "child-a",
      title: "Child A",
      parentCaseId: root.case.id,
      actor: userActor,
    });
    const childB = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "child-b",
      title: "Child B",
      parentCaseId: root.case.id,
      actor: userActor,
    });
    const childC = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "child-c",
      title: "Child C",
      parentCaseId: root.case.id,
      actor: userActor,
    });
    const grandA = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "grand-a",
      title: "Grand A",
      parentCaseId: childA.case.id,
      actor: userActor,
    });
    const grandB = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "grand-b",
      title: "Grand B",
      parentCaseId: childA.case.id,
      actor: userActor,
    });

    await svc.transitionCase({ companyId: company.id, caseId: childB.case.id, toStageKey: "done", expectedVersion: 1, actor: userActor });
    await svc.transitionCase({ companyId: company.id, caseId: childC.case.id, toStageKey: "done", expectedVersion: 1, actor: userActor });
    await svc.transitionCase({ companyId: company.id, caseId: grandA.case.id, toStageKey: "done", expectedVersion: 1, actor: userActor });
    await svc.transitionCase({ companyId: company.id, caseId: grandB.case.id, toStageKey: "cancelled", expectedVersion: 1, actor: userActor });
    await svc.transitionCase({ companyId: company.id, caseId: childA.case.id, toStageKey: "done", expectedVersion: 1, actor: userActor });

    expect(await svc.getCaseRollup(company.id, root.case.id)).toEqual({
      total: 5,
      done: 4,
      cancelled: 1,
      open: 0,
      complete: true,
    });
    const [freshRoot] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, root.case.id));
    const [freshChildA] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, childA.case.id));
    expect(freshRoot!.childCount).toBe(3);
    expect(freshRoot!.terminalChildCount).toBe(3);
    expect(freshChildA!.childCount).toBe(2);
    expect(freshChildA!.terminalChildCount).toBe(2);
    const rootEvents = await svc.listCaseEvents(company.id, root.case.id);
    expect(rootEvents.filter((event) => event.type === "children_terminal")).toHaveLength(1);
    const comments = await db.select().from(issueComments).where(eq(issueComments.issueId, linkedIssue!.id));
    expect(comments).toHaveLength(1);
    expect(comments[0]!.authorType).toBe("system");
    expect(comments[0]!.body).toContain("All child cases");
  });

  it("auto-advances a parent when all descendants are terminal", async () => {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "auto-children",
      name: "Auto children",
      actor: userActor,
      stages: [
        { key: "intake", name: "Intake", kind: "open", config: { autoAdvanceOnChildrenTerminal: "done" } },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const root = await svc.ingestCase({ companyId: company.id, pipelineId: pipeline.id, caseKey: "auto-root", title: "Root", actor: userActor });
    const child = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "auto-child",
      title: "Child",
      parentCaseId: root.case.id,
      actor: userActor,
    });

    await svc.transitionCase({ companyId: company.id, caseId: child.case.id, toStageKey: "done", expectedVersion: 1, actor: userActor });

    const [freshRoot] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, root.case.id));
    expect(freshRoot!.terminalKind).toBe("done");
    expect(freshRoot!.version).toBe(2);
    const rootEvents = await svc.listCaseEvents(company.id, root.case.id);
    expect(rootEvents.map((event) => event.type)).toEqual(["ingested", "children_terminal", "transitioned"]);
  });

  it("auto-advances a leased parent when child completion triggers a system transition", async () => {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "auto-children-lease",
      name: "Auto children lease",
      actor: userActor,
      stages: [
        { key: "intake", name: "Intake", kind: "open", config: { autoAdvanceOnChildrenTerminal: "done" } },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const root = await svc.ingestCase({ companyId: company.id, pipelineId: pipeline.id, caseKey: "leased-root", title: "Root", actor: userActor });
    const child = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "leased-child",
      title: "Child",
      parentCaseId: root.case.id,
      actor: userActor,
    });
    await svc.claimCase({
      companyId: company.id,
      caseId: root.case.id,
      actor: { type: "user", userId: "reviewer" },
    });

    await svc.transitionCase({ companyId: company.id, caseId: child.case.id, toStageKey: "done", expectedVersion: 1, actor: userActor });

    const [freshRoot] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, root.case.id));
    expect(freshRoot!.terminalKind).toBe("done");
    expect(freshRoot!.leaseToken).toBeNull();
    const rootEvents = await svc.listCaseEvents(company.id, root.case.id);
    expect(rootEvents.map((event) => event.type)).toEqual(["ingested", "claimed", "children_terminal", "transitioned"]);
  });

  it("atomically consumes a parent and records proof when its single child is done", async () => {
    const company = await seedCompany();
    const topics = await svc.createPipeline({
      companyId: company.id,
      key: "topic-outcome-done",
      name: "Topic outcome done",
      actor: userActor,
      stages: [
        {
          key: "reserved",
          name: "Reserved",
          kind: "working",
          config: {
            childrenTerminalOutcome: {
              allDoneToStageKey: "consumed",
              anyCancelledToStageKey: "ready",
              requireCurrentDirectChild: true,
              childCaseIdField: "consumingArticleCaseId",
              proofField: "consumingArticleProof",
            },
          },
        },
        { key: "ready", name: "Ready", kind: "working" },
        { key: "consumed", name: "Consumed", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const articles = await svc.createPipeline({
      companyId: company.id,
      key: "article-outcome-done",
      name: "Article outcome done",
      actor: userActor,
      stages: [
        { key: "work", name: "Work", kind: "working" },
        { key: "delivered", name: "Delivered", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const topic = await svc.ingestCase({
      companyId: company.id,
      pipelineId: topics.id,
      stageKey: "reserved",
      caseKey: "topic:done",
      title: "Done topic",
      actor: userActor,
    });
    const article = await svc.ingestCase({
      companyId: company.id,
      pipelineId: articles.id,
      stageKey: "work",
      caseKey: "article:done",
      title: "Done article",
      parentCaseId: topic.case.id,
      actor: userActor,
    });

    await svc.transitionCase({
      companyId: company.id,
      caseId: article.case.id,
      toStageKey: "delivered",
      expectedVersion: article.case.version,
      actor: userActor,
    });

    const [freshTopic] = await db
      .select({ stageKey: pipelineStages.key, fields: pipelineCases.fields, version: pipelineCases.version })
      .from(pipelineCases)
      .innerJoin(pipelineStages, eq(pipelineCases.stageId, pipelineStages.id))
      .where(eq(pipelineCases.id, topic.case.id));
    expect(freshTopic!.stageKey).toBe("consumed");
    expect(freshTopic!.fields.consumingArticleCaseId).toBe(article.case.id);
    expect(freshTopic!.fields.consumingArticleProof).toMatchObject({
      childCaseId: article.case.id,
      childCaseKey: "article:done",
      terminalKind: "done",
      rollup: { total: 1, done: 1, cancelled: 0, open: 0, complete: true },
    });
    expect(freshTopic!.version).toBe(2);
    const events = await svc.listCaseEvents(company.id, topic.case.id);
    expect(events.filter((event) => event.type === "children_terminal")).toHaveLength(1);
    expect(events.filter((event) => event.type === "transitioned")).toHaveLength(1);
  });

  it("atomically releases a parent to ready when its single child is cancelled", async () => {
    const company = await seedCompany();
    const topics = await svc.createPipeline({
      companyId: company.id,
      key: "topic-outcome-cancelled",
      name: "Topic outcome cancelled",
      actor: userActor,
      stages: [
        {
          key: "reserved",
          name: "Reserved",
          kind: "working",
          config: {
            childrenTerminalOutcome: {
              allDoneToStageKey: "consumed",
              anyCancelledToStageKey: "ready",
              requireCurrentDirectChild: true,
              childCaseIdField: "consumingArticleCaseId",
              proofField: "consumingArticleProof",
            },
          },
        },
        { key: "ready", name: "Ready", kind: "working" },
        { key: "consumed", name: "Consumed", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const articles = await svc.createPipeline({
      companyId: company.id,
      key: "article-outcome-cancelled",
      name: "Article outcome cancelled",
      actor: userActor,
      stages: [
        { key: "work", name: "Work", kind: "working" },
        { key: "delivered", name: "Delivered", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const topic = await svc.ingestCase({
      companyId: company.id,
      pipelineId: topics.id,
      stageKey: "reserved",
      caseKey: "topic:cancelled",
      title: "Cancelled topic",
      actor: userActor,
    });
    const article = await svc.ingestCase({
      companyId: company.id,
      pipelineId: articles.id,
      stageKey: "work",
      caseKey: "article:cancelled",
      title: "Cancelled article",
      parentCaseId: topic.case.id,
      actor: userActor,
    });

    await svc.transitionCase({
      companyId: company.id,
      caseId: article.case.id,
      toStageKey: "cancelled",
      expectedVersion: article.case.version,
      actor: userActor,
    });

    const [freshTopic] = await db
      .select({ stageKey: pipelineStages.key, fields: pipelineCases.fields })
      .from(pipelineCases)
      .innerJoin(pipelineStages, eq(pipelineCases.stageId, pipelineStages.id))
      .where(eq(pipelineCases.id, topic.case.id));
    expect(freshTopic!.stageKey).toBe("ready");
    expect(freshTopic!.fields.consumingArticleCaseId).toBe(article.case.id);
    expect(freshTopic!.fields.consumingArticleProof).toMatchObject({
      childCaseId: article.case.id,
      terminalKind: "cancelled",
      rollup: { total: 1, done: 0, cancelled: 1, open: 0, complete: true },
    });

    const releasedTopic = await db
      .select()
      .from(pipelineCases)
      .where(eq(pipelineCases.id, topic.case.id))
      .then((rows) => rows[0]!);
    const retryArticle = await svc.ingestCase({
      companyId: company.id,
      pipelineId: articles.id,
      stageKey: "work",
      caseKey: "article:cancelled:allocation-2",
      title: "Retry article",
      parentCaseId: topic.case.id,
      actor: userActor,
    });
    const reservedAgain = await svc.transitionCase({
      companyId: company.id,
      caseId: topic.case.id,
      toStageKey: "reserved",
      expectedVersion: releasedTopic.version,
      actor: userActor,
    });
    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: retryArticle.case.id,
      toStageKey: "delivered",
      expectedVersion: retryArticle.case.version,
      actor: userActor,
    })).rejects.toMatchObject({
      status: 409,
      details: { code: "children_terminal_outcome_stale_current_child" },
    });
    const [rolledBackRetryArticle] = await db
      .select()
      .from(pipelineCases)
      .where(eq(pipelineCases.id, retryArticle.case.id));
    expect(rolledBackRetryArticle!.terminalKind).toBeNull();
    const topicWithCurrentAllocation = await svc.patchCaseContent({
      companyId: company.id,
      caseId: topic.case.id,
      expectedVersion: reservedAgain.case.version,
      fields: {
        ...reservedAgain.case.fields,
        consumingArticleCaseId: retryArticle.case.id,
      },
      actor: userActor,
    });
    await svc.transitionCase({
      companyId: company.id,
      caseId: retryArticle.case.id,
      toStageKey: "delivered",
      expectedVersion: retryArticle.case.version,
      actor: userActor,
    });

    const [consumedAfterRetry] = await db
      .select({ stageKey: pipelineStages.key, fields: pipelineCases.fields })
      .from(pipelineCases)
      .innerJoin(pipelineStages, eq(pipelineCases.stageId, pipelineStages.id))
      .where(eq(pipelineCases.id, topicWithCurrentAllocation.id));
    expect(consumedAfterRetry!.stageKey).toBe("consumed");
    expect(consumedAfterRetry!.fields.consumingArticleCaseId).toBe(retryArticle.case.id);
    expect(consumedAfterRetry!.fields.consumingArticleProof).toMatchObject({
      childCaseId: retryArticle.case.id,
      terminalKind: "done",
      rollup: { total: 2, done: 1, cancelled: 1, open: 0, complete: true },
    });
  });

  it("rolls back child completion when a typed children-terminal outcome cannot transition the parent", async () => {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "strict-child-outcome",
      name: "Strict child outcome",
      actor: userActor,
      stages: [
        {
          key: "reserved",
          name: "Reserved",
          kind: "working",
          config: {
            childrenTerminalOutcome: {
              allDoneToStageKey: "consumed",
              anyCancelledToStageKey: "ready",
              requireCurrentDirectChild: true,
              childCaseIdField: "consumingArticleCaseId",
              proofField: "consumingArticleProof",
            },
          },
        },
        { key: "ready", name: "Ready", kind: "working" },
        { key: "consumed", name: "Consumed", kind: "done" },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const topic = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "reserved",
      caseKey: "strict-parent",
      title: "Strict parent",
      actor: userActor,
    });
    const article = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "ready",
      caseKey: "strict-child",
      title: "Strict child",
      parentCaseId: topic.case.id,
      actor: userActor,
    });
    const blocker = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "ready",
      caseKey: "strict-blocker",
      title: "Strict blocker",
      actor: userActor,
    });
    await svc.replaceBlockers({
      companyId: company.id,
      caseId: topic.case.id,
      blockedByCaseIds: [blocker.case.id],
      actor: userActor,
    });

    await expect(svc.transitionCase({
      companyId: company.id,
      caseId: article.case.id,
      toStageKey: "done",
      expectedVersion: article.case.version,
      actor: userActor,
    })).rejects.toMatchObject({ status: 409, details: { code: "blocked" } });

    const [freshArticle] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, article.case.id));
    const [freshTopic] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, topic.case.id));
    expect(freshArticle!.terminalKind).toBeNull();
    expect(freshArticle!.stageId).toBe(article.case.stageId);
    expect(freshTopic!.terminalChildCount).toBe(0);
    expect(freshTopic!.fields).toEqual({});
    const events = await svc.listCaseEvents(company.id, topic.case.id);
    expect(events.map((event) => event.type)).toEqual(["ingested", "blockers_set"]);
  });

  it("reconciles stale blocked execution links only when every active linked case is terminal or retired", async () => {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "terminal-issue-reconciliation",
      name: "Terminal issue reconciliation",
      actor: userActor,
      stages: [
        { key: "work", name: "Work", kind: "working" },
        { key: "external_wait", name: "External wait", kind: "working" },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const terminalCase = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "work",
      caseKey: "terminal-link-case",
      title: "Terminal linked case",
      actor: userActor,
    });
    const liveCase = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "external_wait",
      caseKey: "live-external-wait-case",
      title: "Live external wait case",
      actor: userActor,
    });
    const staleAutomation = await seedLinkedIssue({
      companyId: company.id,
      caseId: terminalCase.case.id,
      role: "automation",
      status: "blocked",
      title: "Stale automation",
    });
    const staleWork = await seedLinkedIssue({
      companyId: company.id,
      caseId: terminalCase.case.id,
      role: "work",
      status: "blocked",
      title: "Stale work",
    });
    const sharedLive = await seedLinkedIssue({
      companyId: company.id,
      caseId: terminalCase.case.id,
      role: "work",
      status: "blocked",
      title: "Shared live work",
    });
    await db.insert(pipelineCaseIssueLinks).values({
      companyId: company.id,
      caseId: liveCase.case.id,
      issueId: sharedLive.id,
      role: "automation",
    });
    const unrelatedOrigin = await seedLinkedIssue({
      companyId: company.id,
      caseId: terminalCase.case.id,
      role: "origin",
      status: "blocked",
      title: "Origin wait",
    });

    await svc.transitionCase({
      companyId: company.id,
      caseId: terminalCase.case.id,
      toStageKey: "done",
      expectedVersion: terminalCase.case.version,
      actor: userActor,
    });

    const issueRows = await db
      .select({ id: issues.id, status: issues.status, cancelledAt: issues.cancelledAt })
      .from(issues)
      .where(inArray(issues.id, [staleAutomation.id, staleWork.id, sharedLive.id, unrelatedOrigin.id]));
    const issueById = new Map(issueRows.map((row) => [row.id, row]));
    expect(issueById.get(staleAutomation.id)).toMatchObject({ status: "cancelled" });
    expect(issueById.get(staleAutomation.id)!.cancelledAt).not.toBeNull();
    expect(issueById.get(staleWork.id)).toMatchObject({ status: "cancelled" });
    expect(issueById.get(sharedLive.id)).toMatchObject({ status: "blocked", cancelledAt: null });
    expect(issueById.get(unrelatedOrigin.id)).toMatchObject({ status: "blocked", cancelledAt: null });

    const links = await db
      .select({ issueId: pipelineCaseIssueLinks.issueId, retiredAt: pipelineCaseIssueLinks.retiredAt })
      .from(pipelineCaseIssueLinks)
      .where(inArray(pipelineCaseIssueLinks.issueId, [staleAutomation.id, staleWork.id, sharedLive.id]));
    expect(links.filter((link) => link.issueId === staleAutomation.id).every((link) => link.retiredAt !== null)).toBe(true);
    expect(links.filter((link) => link.issueId === staleWork.id).every((link) => link.retiredAt !== null)).toBe(true);
    expect(links.filter((link) => link.issueId === sharedLive.id).every((link) => link.retiredAt === null)).toBe(true);
  });

  it("retires a blocked automation issue when a later active execution advances the case", async () => {
    const company = await seedCompany();
    const routine = await seedRoutine(company.id, "Recoverable CMS delivery");
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "superseded-automation-reconciliation",
      name: "Superseded automation reconciliation",
      actor: userActor,
      stages: [
        { key: "cms", name: "CMS", kind: "working" },
        { key: "delivery", name: "Delivery", kind: "working" },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageKey: "cms",
      caseKey: "recovered-cms",
      title: "Recovered CMS",
      actor: userActor,
    });
    const stale = await seedLinkedIssue({
      companyId: company.id,
      caseId: created.case.id,
      role: "automation",
      status: "blocked",
      title: "Blocked CMS attempt",
    });
    const successor = await seedLinkedIssue({
      companyId: company.id,
      caseId: created.case.id,
      role: "automation",
      status: "in_progress",
      title: "Successful CMS recovery",
    });
    const [firstEvent] = await db.insert(pipelineCaseEvents).values({
      companyId: company.id,
      caseId: created.case.id,
      type: "updated",
      actorType: "system",
      payload: { test: "stale" },
    }).returning();
    const [secondEvent] = await db.insert(pipelineCaseEvents).values({
      companyId: company.id,
      caseId: created.case.id,
      type: "updated",
      actorType: "system",
      payload: { test: "successor" },
    }).returning();
    await db.insert(pipelineAutomationExecutions).values([
      {
        companyId: company.id,
        caseId: created.case.id,
        automationId: "cms:on_enter",
        triggeringEventId: firstEvent!.id,
        routineId: routine.id,
        executionIssueId: stale.id,
        status: "succeeded",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        companyId: company.id,
        caseId: created.case.id,
        automationId: "cms:on_enter",
        triggeringEventId: secondEvent!.id,
        routineId: routine.id,
        executionIssueId: successor.id,
        status: "succeeded",
        createdAt: new Date("2026-01-01T00:00:01.000Z"),
        updatedAt: new Date("2026-01-01T00:00:01.000Z"),
      },
    ]);

    await svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "delivery",
      expectedVersion: created.case.version,
      actor: userActor,
    });

    const [staleIssue] = await db.select().from(issues).where(eq(issues.id, stale.id));
    expect(staleIssue).toMatchObject({ status: "cancelled" });
    const [staleLink] = await db
      .select()
      .from(pipelineCaseIssueLinks)
      .where(eq(pipelineCaseIssueLinks.issueId, stale.id));
    expect(staleLink!.retiredReason).toBe("superseded_by_later_successful_automation");
    const events = await svc.listCaseEvents(company.id, created.case.id);
    expect(events.some((event) => event.type === "automation_effects_retired"
      && (event.payload as Record<string, unknown>).reason === "superseded_by_later_successful_automation")).toBe(true);
  });

  it("keeps child completion committed when parent children-terminal auto-advance is gated", async () => {
    const company = await seedCompany();
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "auto-children-blocked",
      name: "Auto children blocked",
      actor: userActor,
      stages: [
        { key: "intake", name: "Intake", kind: "open", config: { autoAdvanceOnChildrenTerminal: "done" } },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const root = await svc.ingestCase({ companyId: company.id, pipelineId: pipeline.id, caseKey: "blocked-root", title: "Root", actor: userActor });
    const child = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "blocked-child",
      title: "Child",
      parentCaseId: root.case.id,
      actor: userActor,
    });
    const blocker = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "open-blocker",
      title: "Open blocker",
      actor: userActor,
    });
    await svc.replaceBlockers({
      companyId: company.id,
      caseId: root.case.id,
      blockedByCaseIds: [blocker.case.id],
      actor: userActor,
    });

    await expect(
      svc.transitionCase({ companyId: company.id, caseId: child.case.id, toStageKey: "done", expectedVersion: 1, actor: userActor }),
    ).resolves.toMatchObject({ case: { terminalKind: "done" } });

    const [freshRoot] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, root.case.id));
    const [freshChild] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, child.case.id));
    expect(freshRoot!.terminalKind).toBeNull();
    expect(freshRoot!.terminalChildCount).toBe(1);
    expect(freshChild!.terminalKind).toBe("done");
    const rootEvents = await svc.listCaseEvents(company.id, root.case.id);
    expect(rootEvents.map((event) => event.type)).toEqual(["ingested", "blockers_set", "children_terminal"]);
  });

  it("records suggestion supersede, accept, and dismiss lifecycles", async () => {
    const { company, pipeline } = await seedPipeline();
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "suggest-accept",
      title: "Suggestion accept",
      actor: userActor,
    });
    const first = await svc.suggestTransition({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "review",
      rationale: "Needs review",
      actor: userActor,
    });
    const second = await svc.suggestTransition({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "in_progress",
      rationale: "Actually draft first",
      actor: userActor,
    });
    expect(second.suggestion.id).not.toBe(first.suggestion.id);

    const accepted = await svc.resolveSuggestion({
      companyId: company.id,
      caseId: created.case.id,
      suggestionId: second.suggestion.id,
      decision: "accept",
      expectedVersion: 1,
      actor: userActor,
    });
    expect(accepted.case.version).toBe(2);
    const acceptEvents = await svc.listCaseEvents(company.id, created.case.id);
    expect(acceptEvents.map((event) => event.type)).toEqual([
      "ingested",
      "transition_suggested",
      "transition_suggested",
      "transitioned",
      "suggestion_resolved",
    ]);

    const dismissCase = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "suggest-dismiss",
      title: "Suggestion dismiss",
      actor: userActor,
    });
    const suggestion = await svc.suggestTransition({
      companyId: company.id,
      caseId: dismissCase.case.id,
      toStageKey: "review",
      rationale: "Maybe review",
      actor: userActor,
    });
    await svc.resolveSuggestion({
      companyId: company.id,
      caseId: dismissCase.case.id,
      suggestionId: suggestion.suggestion.id,
      decision: "dismiss",
      reason: "Not ready",
      actor: userActor,
    });
    const [dismissed] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, dismissCase.case.id));
    expect(dismissed!.pendingSuggestion).toBeNull();
    expect(dismissed!.version).toBe(1);
  });

  it("writes an event for each case mutation and rejects agent mutations without run provenance", async () => {
    const { company, pipeline } = await seedPipeline();
    const agentActor = { type: "agent", agentId: randomUUID() } as PipelineActor;
    await expect(
      svc.ingestCase({
        companyId: company.id,
        pipelineId: pipeline.id,
        caseKey: "bad-agent",
        title: "Bad provenance",
        actor: agentActor,
      }),
    ).rejects.toMatchObject({ status: 422, details: { code: "run_id_required" } });

    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "events",
      title: "Events",
      actor: userActor,
    });
    expect(await eventCount(created.case.id)).toBe(1);
    await svc.patchCaseContent({ companyId: company.id, caseId: created.case.id, title: "Updated", actor: userActor });
    expect(await eventCount(created.case.id)).toBe(2);
    const claimed = await svc.claimCase({ companyId: company.id, caseId: created.case.id, actor: { type: "user", userId: "claimer" } });
    expect(await eventCount(created.case.id)).toBe(3);
    await svc.releaseCase({ companyId: company.id, caseId: created.case.id, leaseToken: claimed.leaseToken, actor: { type: "user", userId: "claimer" } });
    expect(await eventCount(created.case.id)).toBe(4);
    await svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "in_progress",
      expectedVersion: 2,
      actor: userActor,
    });
    expect(await eventCount(created.case.id)).toBe(5);
  });

  it("fires a stage-entry automation routine once and keeps crash-retry idempotent", async () => {
    const company = await seedCompany();
    const routine = await seedRoutine(company.id, "Draft on enter");
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "automation",
      name: "Automation",
      actor: userActor,
      stages: [
        { key: "intake", name: "Intake", kind: "open" },
        {
          key: "drafting",
          name: "Drafting",
          kind: "working",
          config: {
            inlineContextDocumentKeys: ["article-brief"],
            inlineContextMaxChars: 8_000,
            onEnter: { type: "run_routine", routineId: routine.id },
          },
        },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "automation",
      title: "Automation case",
      actor: userActor,
    });
    const [briefDocument] = await db.insert(documents).values({
      companyId: company.id,
      title: "Article brief",
      format: "markdown",
      latestBody: "# Article brief\n\nFULL_BRIEF_BODY_FOR_TOOLLESS_ADAPTER",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    }).returning();
    const [briefRevision] = await db.insert(documentRevisions).values({
      companyId: company.id,
      documentId: briefDocument!.id,
      revisionNumber: 1,
      title: "Article brief",
      format: "markdown",
      body: briefDocument!.latestBody,
      createdByUserId: "board-user",
    }).returning();
    await db.update(documents).set({ latestRevisionId: briefRevision!.id }).where(eq(documents.id, briefDocument!.id));
    await db.insert(pipelineCaseDocuments).values({
      companyId: company.id,
      caseId: created.case.id,
      documentId: briefDocument!.id,
      key: "article-brief",
    });

    const moved = await svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "drafting",
      expectedVersion: 1,
      actor: userActor,
    });
    expect(moved.automationLedger?.routineId).toBe(routine.id);
    expect(moved.automationExecution.status).toBe("succeeded");
    const ledgers = await db.select().from(pipelineAutomationExecutions);
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0]!.triggeringEventId).toBe(moved.event.id);
    expect(ledgers[0]!.executionIssueId).toBeTruthy();
    const runsAfterTransition = await db.select().from(routineRuns);
    expect(runsAfterTransition).toHaveLength(1);
    const linksAfterTransition = await db.select().from(pipelineCaseIssueLinks);
    expect(linksAfterTransition).toHaveLength(1);
    expect(linksAfterTransition[0]!.role).toBe("automation");

    const [issue] = await db.select().from(issues).where(eq(issues.id, ledgers[0]!.executionIssueId!));
    expect(issue!.description).toContain("Pipeline Case Context");
    expect(issue!.description).toContain("references/pipeline-cases.md");
    expect(issue!.description).toContain("Do not search OpenAPI");
    expect(issue!.description).not.toContain("pipeline-case-operations");
    expect(issue!.description).toContain("untrustedContent");
    expect(issue!.description).toContain("Inline Pipeline Documents");
    expect(issue!.description).toContain("FULL_BRIEF_BODY_FOR_TOOLLESS_ADAPTER");

    const triggerEvent = await db.insert(pipelineCaseEvents).values({
      companyId: company.id,
      caseId: created.case.id,
      type: "transitioned",
      actorType: "system",
      toStageId: moved.case.stageId,
      payload: { simulatedCrash: true },
    }).returning();
    const automationId = ledgers[0]!.automationId;
    await db.insert(pipelineAutomationExecutions).values({
      companyId: company.id,
      caseId: created.case.id,
      automationId,
      triggeringEventId: triggerEvent[0]!.id,
      routineId: routine.id,
      status: "failed",
      error: "pending_dispatch",
    });

    const firstRetry = await svc.retryAutomation({
      companyId: company.id,
      caseId: created.case.id,
      automationId,
      actor: userActor,
    });
    const secondRetry = await svc.retryAutomation({
      companyId: company.id,
      caseId: created.case.id,
      automationId,
      actor: userActor,
    });
    expect(firstRetry.status).toBe("succeeded");
    expect(secondRetry.status).toBe("succeeded");
    const runsAfterRetries = await db.select().from(routineRuns);
    expect(runsAfterRetries).toHaveLength(2);
    const crashExecutions = await db
      .select()
      .from(pipelineAutomationExecutions)
      .where(eq(pipelineAutomationExecutions.triggeringEventId, triggerEvent[0]!.id));
    expect(crashExecutions).toHaveLength(1);
    expect(crashExecutions[0]!.executionIssueId).toBeTruthy();
    const crashLinks = await db
      .select()
      .from(pipelineCaseIssueLinks)
      .where(eq(pipelineCaseIssueLinks.issueId, crashExecutions[0]!.executionIssueId!));
    expect(crashLinks).toHaveLength(1);
  });

  it("carries saved stage automation workspace context into the execution issue", async () => {
    const { company, pipeline, byKey } = await seedPipeline();
    const routineSeed = await seedRoutine(company.id, "Workspace automation seed");
    const projectId = randomUUID();
    const projectWorkspaceId = randomUUID();
    const executionWorkspaceId = randomUUID();

    await instanceSettingsService(db).updateExperimental({ enableIsolatedWorkspaces: true });
    await db.insert(projects).values({
      id: projectId,
      companyId: company.id,
      name: "Automation project",
      status: "in_progress",
    });
    await db.insert(projectWorkspaces).values({
      id: projectWorkspaceId,
      companyId: company.id,
      projectId,
      name: "Automation workspace",
      isPrimary: true,
      sharedWorkspaceKey: "pipeline-automation-primary",
    });
    await db.insert(executionWorkspaces).values({
      id: executionWorkspaceId,
      companyId: company.id,
      projectId,
      projectWorkspaceId,
      mode: "isolated_workspace",
      strategyType: "git_worktree",
      name: "Automation worktree",
      status: "active",
      providerType: "git_worktree",
    });

    const updatedStage = await svc.updateStage({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageId: byKey.get("in_progress")!.id,
      patch: {
        config: {
          automation: {
            assigneeAgentId: routineSeed.assigneeAgentId,
            instructionsBody: "Use the selected workspace.",
            projectId,
            projectWorkspaceId,
            executionWorkspaceId,
            executionWorkspacePreference: "reuse_existing",
            executionWorkspaceSettings: { mode: "isolated_workspace" },
          },
        },
      },
      actor: userActor,
    });
    expect((updatedStage.config as { onEnter?: unknown }).onEnter).toMatchObject({
      type: "run_routine",
      projectId,
      projectWorkspaceId,
      executionWorkspaceId,
      executionWorkspacePreference: "reuse_existing",
      executionWorkspaceSettings: { mode: "isolated_workspace" },
    });

    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "workspace-context",
      title: "Workspace context case",
      actor: userActor,
    });
    const moved = await svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "in_progress",
      expectedVersion: 1,
      actor: userActor,
    });

    expect(moved.automationExecution.status).toBe("succeeded");
    const executionIssueId = moved.automationExecution.status === "succeeded"
      ? moved.automationExecution.execution.executionIssueId
      : null;
    const [issue] = await db
      .select({
        projectId: issues.projectId,
        projectWorkspaceId: issues.projectWorkspaceId,
        executionWorkspaceId: issues.executionWorkspaceId,
        executionWorkspacePreference: issues.executionWorkspacePreference,
        executionWorkspaceSettings: issues.executionWorkspaceSettings,
      })
      .from(issues)
      .where(eq(issues.id, executionIssueId!));

    expect(issue).toEqual({
      projectId,
      projectWorkspaceId,
      executionWorkspaceId,
      executionWorkspacePreference: "reuse_existing",
      executionWorkspaceSettings: { mode: "isolated_workspace" },
    });
  });

  it("rejects cross-company stage automation routines at save and execution", async () => {
    const company = await seedCompany();
    const otherCompany = await seedCompany();
    const routine = await seedRoutine(company.id, "Own routine");
    const otherRoutine = await seedRoutine(otherCompany.id, "Other routine");

    await expect(svc.createPipeline({
      companyId: company.id,
      key: "bad-automation",
      name: "Bad automation",
      actor: userActor,
      stages: [
        { key: "intake", name: "Intake", kind: "open" },
        { key: "drafting", name: "Drafting", kind: "working", config: { onEnter: { type: "run_routine", routineId: otherRoutine.id } } },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    })).rejects.toMatchObject({ status: 422, details: { code: "validation" } });

    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "execution-automation",
      name: "Execution automation",
      actor: userActor,
      stages: [
        { key: "intake", name: "Intake", kind: "open" },
        { key: "drafting", name: "Drafting", kind: "working", config: { onEnter: { type: "run_routine", routineId: routine.id } } },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const created = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "cross-company-execution",
      title: "Cross-company execution",
      actor: userActor,
    });
    const moved = await svc.transitionCase({
      companyId: company.id,
      caseId: created.case.id,
      toStageKey: "drafting",
      expectedVersion: 1,
      actor: userActor,
    });
    expect(moved.automationExecution.status).toBe("succeeded");

    const [triggerEvent] = await db.insert(pipelineCaseEvents).values({
      companyId: company.id,
      caseId: created.case.id,
      type: "transitioned",
      actorType: "system",
      toStageId: moved.case.stageId,
      payload: { crossCompanyRoutine: true },
    }).returning();
    const [badExecution] = await db.insert(pipelineAutomationExecutions).values({
      companyId: company.id,
      caseId: created.case.id,
      automationId: moved.automationLedger!.automationId,
      triggeringEventId: triggerEvent!.id,
      routineId: otherRoutine.id,
      status: "failed",
      error: "pending_dispatch",
    }).returning();

    const retried = await svc.retryAutomation({
      companyId: company.id,
      caseId: created.case.id,
      automationId: moved.automationLedger!.automationId,
      actor: userActor,
    });
    expect(retried.status).toBe("failed");
    const [execution] = await db
      .select()
      .from(pipelineAutomationExecutions)
      .where(eq(pipelineAutomationExecutions.id, badExecution!.id));
    expect(execution!.error).toContain("same company");
    const events = await svc.listCaseEvents(company.id, created.case.id);
    expect(events.filter((event) => event.type === "automation_failed")).toHaveLength(1);
  });

  it("auto-advances after retry creates a fresh terminal child rollup", async () => {
    const company = await seedCompany();
    const routine = await seedRoutine(company.id, "Retry child cleanup");
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "retry-child-cleanup",
      name: "Retry child cleanup",
      actor: userActor,
      stages: [
        {
          key: "build",
          name: "Build",
          kind: "working",
          config: {
            autoAdvanceOnChildrenTerminal: "review",
            onEnter: {
              type: "run_routine",
              id: "build-children",
              routineId: routine.id,
            },
          },
        },
        { key: "review", name: "Review", kind: "working" },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const parent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "parent",
      title: "Parent",
      actor: userActor,
    });
    const [event] = await db.insert(pipelineCaseEvents).values({
      companyId: company.id,
      caseId: parent.case.id,
      type: "transitioned",
      actorType: "system",
      toStageId: parent.case.stageId,
      payload: { test: true },
    }).returning();
    const [attempt] = await db.insert(pipelineAutomationExecutions).values({
      companyId: company.id,
      caseId: parent.case.id,
      automationId: "build-children",
      triggeringEventId: event!.id,
      routineId: routine.id,
      status: "failed",
      error: "boom",
    }).returning();
    const child = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "child",
      title: "Child",
      parentCaseId: parent.case.id,
      actor: userActor,
    });
    await db
      .update(pipelineCases)
      .set({ automationAttemptId: attempt!.id })
      .where(eq(pipelineCases.id, child.case.id));
    await svc.transitionCase({
      companyId: company.id,
      caseId: child.case.id,
      toStageKey: "done",
      expectedVersion: child.case.version,
      actor: userActor,
    });
    const [reviewingParent] = await db
      .select({ version: pipelineCases.version, stageKey: pipelineStages.key })
      .from(pipelineCases)
      .innerJoin(pipelineStages, eq(pipelineCases.stageId, pipelineStages.id))
      .where(eq(pipelineCases.id, parent.case.id));
    expect(reviewingParent!.stageKey).toBe("review");
    const staleRetriedAutomation = await seedLinkedIssue({
      companyId: company.id,
      caseId: child.case.id,
      role: "automation",
      status: "blocked",
      title: "Stale retried automation",
    });

    const retry = await svc.retryStageAutomation({
      companyId: company.id,
      caseId: parent.case.id,
      scope: "previous_stage",
      targetStageId: event!.toStageId,
      expectedVersion: reviewingParent!.version,
      cleanup: {
        retireDirectChildren: true,
        retireDescendants: true,
        cancelLinkedAutomationIssues: true,
      },
      actor: userActor,
    });
    const retryChild = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "retry-child",
      title: "Retry child",
      parentCaseId: parent.case.id,
      actor: userActor,
    });
    await db
      .update(pipelineCases)
      .set({ automationAttemptId: retry.automationLedger.id })
      .where(eq(pipelineCases.id, retryChild.case.id));
    await svc.transitionCase({
      companyId: company.id,
      caseId: retryChild.case.id,
      toStageKey: "done",
      expectedVersion: retryChild.case.version,
      actor: userActor,
    });

    const [freshParent] = await db
      .select({ childCount: pipelineCases.childCount, terminalChildCount: pipelineCases.terminalChildCount, stageKey: pipelineStages.key })
      .from(pipelineCases)
      .innerJoin(pipelineStages, eq(pipelineCases.stageId, pipelineStages.id))
      .where(eq(pipelineCases.id, parent.case.id));
    const [freshChild] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, child.case.id));
    expect(freshParent!.childCount).toBe(2);
    expect(freshParent!.terminalChildCount).toBe(2);
    expect(freshParent!.stageKey).toBe("review");
    expect(freshChild!.terminalKind).toBe("cancelled");
    expect(freshChild!.retiredReason).toBe("automation_retry");
    const [staleRetriedIssue] = await db.select().from(issues).where(eq(issues.id, staleRetriedAutomation.id));
    expect(staleRetriedIssue!.status).toBe("cancelled");
    const [staleRetriedLink] = await db
      .select()
      .from(pipelineCaseIssueLinks)
      .where(eq(pipelineCaseIssueLinks.issueId, staleRetriedAutomation.id));
    expect(staleRetriedLink!.retiredReason).toBe("case_terminal_cancelled");
    const events = await svc.listCaseEvents(company.id, parent.case.id);
    expect(events.filter((pipelineEvent) => pipelineEvent.type === "children_terminal")).toHaveLength(2);
  });

  it("updates intermediate terminal counts when retry retires descendants only", async () => {
    const company = await seedCompany();
    const routine = await seedRoutine(company.id, "Retry descendants only");
    const pipeline = await svc.createPipeline({
      companyId: company.id,
      key: "retry-descendants-only",
      name: "Retry descendants only",
      actor: userActor,
      stages: [
        {
          key: "build",
          name: "Build",
          kind: "working",
          config: {
            onEnter: {
              type: "run_routine",
              id: "build-descendants",
              routineId: routine.id,
            },
          },
        },
        { key: "done", name: "Done", kind: "done" },
        { key: "cancelled", name: "Cancelled", kind: "cancelled" },
      ],
    });
    const parent = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "descendants-parent",
      title: "Descendants parent",
      actor: userActor,
    });
    const [event] = await db.insert(pipelineCaseEvents).values({
      companyId: company.id,
      caseId: parent.case.id,
      type: "transitioned",
      actorType: "system",
      toStageId: parent.case.stageId,
      payload: { test: true },
    }).returning();
    const [attempt] = await db.insert(pipelineAutomationExecutions).values({
      companyId: company.id,
      caseId: parent.case.id,
      automationId: "build-descendants",
      triggeringEventId: event!.id,
      routineId: routine.id,
      status: "failed",
      error: "boom",
    }).returning();
    const child = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "descendants-child",
      title: "Descendants child",
      parentCaseId: parent.case.id,
      actor: userActor,
    });
    await db
      .update(pipelineCases)
      .set({ automationAttemptId: attempt!.id })
      .where(eq(pipelineCases.id, child.case.id));
    const grandchild = await svc.ingestCase({
      companyId: company.id,
      pipelineId: pipeline.id,
      caseKey: "descendants-grandchild",
      title: "Descendants grandchild",
      parentCaseId: child.case.id,
      actor: userActor,
    });

    await svc.retryStageAutomation({
      companyId: company.id,
      caseId: parent.case.id,
      scope: "current_stage",
      expectedVersion: parent.case.version,
      cleanup: {
        retireDirectChildren: false,
        retireDescendants: true,
        cancelLinkedAutomationIssues: false,
      },
      actor: userActor,
    });

    const [freshParent] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, parent.case.id));
    const [freshChild] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, child.case.id));
    const [freshGrandchild] = await db.select().from(pipelineCases).where(eq(pipelineCases.id, grandchild.case.id));
    expect(freshParent!.terminalChildCount).toBe(0);
    expect(freshChild!.terminalKind).toBeNull();
    expect(freshChild!.terminalChildCount).toBe(1);
    expect(freshGrandchild!.terminalKind).toBe("cancelled");
    expect(freshGrandchild!.retiredReason).toBe("automation_retry");
  });
});
