import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { JOB_KEYS, TOOL_NAMES } from "../src/constants.js";

describe("seo performance loop plugin", () => {
  it("stores registry rows, telemetry snapshots, decisions, jobs, and issue-done observations", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    const overviewBefore = await harness.getData<{
      status: string;
      lastCollectionRun: null;
      lastDecisionRun: null;
    }>("overview");
    expect(overviewBefore.status).toBe("ok");
    expect(overviewBefore.lastCollectionRun).toBeNull();
    expect(overviewBefore.lastDecisionRun).toBeNull();

    const upsertResult = await harness.executeTool<{
      data: {
        implemented: boolean;
        id: string;
        created: boolean;
        article: { canonicalUrl: string; primaryKeyword: string };
      };
    }>(TOOL_NAMES.publishedArticleUpsert, {
      publicationEventKey: "pub_evt_1",
      originIssueId: "iss_1",
      currentIssueId: "iss_1",
      canonicalUrl: "https://astrogen.com.ua/blog/money-test/",
      canonicalSlug: "money-test",
      routeKey: "money",
      productSurface: "blog",
      language: "uk",
      geo: "ua",
      primaryKeyword: "фінансова натальна карта",
      supportingKeywords: ["натальна карта фінансів"],
      titleSnapshot: "Фінансова натальна карта: тест",
      h1Snapshot: "Фінансова натальна карта: тест",
      metaTitleSnapshot: "Фінансова натальна карта: тест | Astrogen",
      metaDescriptionSnapshot: "Фінансова натальна карта: короткий тестовий опис.",
      authorSnapshot: "Astrogen editorial",
      publishableMarkdownAttachmentId: "att_md",
      publishableHtmlAttachmentId: "att_html",
      editorialSourceAttachmentId: "att_src",
      publishedAt: "2026-04-15T00:00:00.000Z",
    });
    expect(upsertResult.data.implemented).toBe(true);
    expect(upsertResult.data.created).toBe(true);
    expect(upsertResult.data.article.canonicalUrl).toBe("https://astrogen.com.ua/blog/money-test");

    const articleId = upsertResult.data.id;
    await harness.executeTool(TOOL_NAMES.telemetrySnapshotRecord, {
      articleId,
      sourceKind: "gsc",
      sourceKey: "https://astrogen.com.ua/",
      snapshotWindowStart: "2026-03-30T00:00:00.000Z",
      snapshotWindowEnd: "2026-04-06T00:00:00.000Z",
      pageMetrics: {
        impressions: 100,
        clicks: 10,
        ctr: 0.1,
        averagePosition: 8,
      },
      rawPayload: { fixture: "previous" },
    });
    await harness.executeTool(TOOL_NAMES.telemetrySnapshotRecord, {
      articleId,
      sourceKind: "gsc",
      sourceKey: "https://astrogen.com.ua/",
      snapshotWindowStart: "2026-04-06T00:00:00.000Z",
      snapshotWindowEnd: "2026-04-13T00:00:00.000Z",
      pageMetrics: {
        impressions: 120,
        clicks: 11,
        ctr: 0.0917,
        averagePosition: 8.5,
      },
      rawPayload: { fixture: "current" },
    });

    await harness.runJob(JOB_KEYS.collectWeeklySearchTelemetry, {
      runId: "run_collect",
      scheduledAt: "2026-04-15T00:00:00.000Z",
    });
    await harness.runJob(JOB_KEYS.evaluateWeeklySeoDecisions, {
      runId: "run_decide",
      scheduledAt: "2026-04-15T01:00:00.000Z",
    });

    const overviewAfterJobs = await harness.getData<{
      status: string;
      lastCollectionRun: { runId: string } | null;
      lastDecisionRun: { runId: string } | null;
    }>("overview");
    expect(overviewAfterJobs.status).toBe("ok");
    expect(overviewAfterJobs.lastCollectionRun?.runId).toBe("run_collect");
    expect(overviewAfterJobs.lastDecisionRun?.runId).toBe("run_decide");

    const toolResult = await harness.executeTool<{
      content: string;
      data: { implemented: boolean; snapshots: unknown[] };
    }>(
      TOOL_NAMES.searchTelemetryGet,
      { articleId, weeksBack: 4 },
    );
    expect(toolResult.data.implemented).toBe(true);
    expect(toolResult.data.snapshots).toHaveLength(2);

    const decisionResult = await harness.executeTool<{
      data: { implemented: boolean; decision: { decisionStatus: string } | null };
    }>(
      TOOL_NAMES.performanceDecisionGet,
      { articleId },
    );
    expect(decisionResult.data.implemented).toBe(true);
    expect(decisionResult.data.decision?.decisionStatus).toBe("hold");

    await harness.emit(
      "issue.updated",
      { status: "done" },
      { entityId: "iss_1", entityType: "issue" },
    );
    expect(
      harness.getState({ scopeKind: "instance", stateKey: "last-observed-issue-done" }),
    ).toMatchObject({ entityId: "iss_1" });
  });

  it("plans ingestion requests without provider calls and records host-dispatched snapshots", async () => {
    const harness = createTestHarness({ manifest });
    harness.setConfig({
      googleSearchConsolePropertyUrl: "https://astrogen.com.ua/",
      defaultRankProvider: "paperclip-connected-provider",
    });
    await plugin.definition.setup(harness.ctx);

    const upsertResult = await harness.executeTool<{
      data: { implemented: boolean; id: string };
    }>(TOOL_NAMES.publishedArticleUpsert, {
      publicationEventKey: "pub_evt_ingestion",
      originIssueId: "iss_ingestion",
      currentIssueId: "iss_ingestion",
      canonicalUrl: "https://astrogen.com.ua/blog/ingestion-test/",
      canonicalSlug: "ingestion-test",
      routeKey: "money",
      productSurface: "blog",
      language: "uk",
      geo: "ua",
      primaryKeyword: "фінансова натальна карта",
      supportingKeywords: ["натальна карта фінансів"],
      titleSnapshot: "Фінансова натальна карта: ingestion test",
      h1Snapshot: "Фінансова натальна карта: ingestion test",
      metaTitleSnapshot: "Фінансова натальна карта: ingestion test | Astrogen",
      metaDescriptionSnapshot: "Фінансова натальна карта: ingestion test description.",
      authorSnapshot: "Astrogen editorial",
      publishableMarkdownAttachmentId: "att_md_ingestion",
      publishableHtmlAttachmentId: "att_html_ingestion",
      editorialSourceAttachmentId: "att_src_ingestion",
      publishedAt: "2026-04-15T00:00:00.000Z",
    });

    const articleId = upsertResult.data.id;
    await harness.runJob(JOB_KEYS.collectWeeklySearchTelemetry, {
      runId: "run_ingestion_plan",
      scheduledAt: "2026-04-15T03:00:00.000Z",
    });

    const overviewAfterPlan = await harness.getData<{
      lastCollectionRun: {
        plannedRequestCount: number;
        createdRequestCount: number;
        dedupedRequestCount: number;
        skippedRequestCount: number;
        requestIds: string[];
        windowStart: string;
        windowEnd: string;
      } | null;
      lastIngestionRun: { runId: string } | null;
    }>("overview");
    expect(overviewAfterPlan.lastCollectionRun?.plannedRequestCount).toBe(2);
    expect(overviewAfterPlan.lastCollectionRun?.createdRequestCount).toBe(2);
    expect(overviewAfterPlan.lastCollectionRun?.dedupedRequestCount).toBe(0);
    expect(overviewAfterPlan.lastCollectionRun?.skippedRequestCount).toBe(0);
    expect(overviewAfterPlan.lastCollectionRun?.requestIds).toHaveLength(2);
    expect(overviewAfterPlan.lastIngestionRun?.runId).toBe("run_ingestion_plan");

    const ingestionLedger = await harness.executeTool<{
      data: {
        implemented: boolean;
        article: { id: string } | null;
        requests: Array<{ requestType: string; sourceKind: string; externalProviderBoundary: Record<string, string> }>;
      };
    }>(TOOL_NAMES.telemetryIngestionGet, {
      articleId,
      limit: 10,
    });
    expect(ingestionLedger.data.implemented).toBe(true);
    expect(ingestionLedger.data.article?.id).toBe(articleId);
    expect(ingestionLedger.data.requests).toHaveLength(2);
    expect(ingestionLedger.data.requests.every((request) => request.requestType === "plan")).toBe(true);
    expect(ingestionLedger.data.requests.every((request) => request.externalProviderBoundary.googleSearchConsole === "not_implemented")).toBe(true);

    const dispatchResult = await harness.executeTool<{
      data: {
        implemented: boolean;
        created: boolean;
        snapshot: { sourceKind: string; pageMetrics: { clicks: number } | null } | null;
      };
    }>(TOOL_NAMES.telemetryIngestionRecord, {
      canonicalUrl: "https://astrogen.com.ua/blog/ingestion-test/",
      sourceKind: "gsc",
      snapshotWindowStart: "2026-04-06T00:00:00.000Z",
      snapshotWindowEnd: "2026-04-13T00:00:00.000Z",
      pageMetrics: {
        impressions: 140,
        clicks: 14,
        ctr: 0.1,
        averagePosition: 6.2,
      },
      queries: [
        {
          query: "фінансова натальна карта",
          clicks: 8,
          impressions: 90,
          ctr: 0.0889,
          averagePosition: 5.8,
        },
      ],
      rawPayload: {
        collection: "host-dispatch",
      },
    });
    expect(dispatchResult.data.implemented).toBe(true);
    expect(dispatchResult.data.created).toBe(true);
    expect(dispatchResult.data.snapshot?.sourceKind).toBe("gsc");
    expect(dispatchResult.data.snapshot?.pageMetrics?.clicks).toBe(14);

    const telemetry = await harness.executeTool<{
      data: {
        implemented: boolean;
        snapshots: Array<{ sourceKind: string; pageMetrics: { clicks: number } | null }>;
      };
    }>(TOOL_NAMES.searchTelemetryGet, {
      articleId,
      weeksBack: 4,
    });
    expect(telemetry.data.implemented).toBe(true);
    expect(telemetry.data.snapshots).toHaveLength(1);
    expect(telemetry.data.snapshots[0].pageMetrics?.clicks).toBe(14);
  });

  it("rejects ingestion requests for missing registry state", async () => {
    const harness = createTestHarness({ manifest });
    harness.setConfig({
      googleSearchConsolePropertyUrl: "https://astrogen.com.ua/",
      defaultRankProvider: "paperclip-connected-provider",
    });
    await plugin.definition.setup(harness.ctx);

    await expect(
      harness.executeTool(TOOL_NAMES.telemetryIngestionRecord, {
        canonicalUrl: "https://astrogen.com.ua/blog/missing-article/",
        sourceKind: "gsc",
        snapshotWindowStart: "2026-04-06T00:00:00.000Z",
        snapshotWindowEnd: "2026-04-13T00:00:00.000Z",
      }),
    ).rejects.toThrow("registered article not found for telemetry ingestion request");
  });
});
