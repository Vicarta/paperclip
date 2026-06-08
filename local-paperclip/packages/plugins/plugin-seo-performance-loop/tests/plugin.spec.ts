import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { JOB_KEYS, TOOL_NAMES } from "../src/constants.js";
import { buildWeeklyReportPlan, routeCrawlFinding } from "../src/report-policy.js";

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

  it("keeps weekly owner reports short in Telegram and detailed over email", async () => {
    const plan = buildWeeklyReportPlan(
      {
        detailedReportChannel: "email",
        detailedReportRecipientEmails: "owner@example.com, cmo@example.com",
        resendApiKeySecretRef: "00000000-0000-4000-8000-000000000001",
        telegramSummaryHardCapChars: 1800,
      },
      "2026-06-10T06:00:00.000Z",
    );

    expect(plan.reportWindowStart).toBe("2026-06-01T00:00:00.000Z");
    expect(plan.reportWindowEnd).toBe("2026-06-08T00:00:00.000Z");
    expect(plan.comparisonWindowStart).toBe("2026-05-25T00:00:00.000Z");
    expect(plan.comparisonWindowEnd).toBe("2026-06-01T00:00:00.000Z");
    expect(plan.telegram.mode).toBe("summary_only");
    expect(plan.telegram.requiredShape.join(" ")).toContain("no raw tables");
    expect(plan.detailed.channel).toBe("email");
    expect(plan.detailed.deliveryReady).toBe(true);
    expect(plan.detailed.fromEmail).toBe("paperclip@aibizmate.com");
    expect(plan.detailed.transportConfigured).toBe(true);
    expect(plan.detailed.recipientEmails).toEqual(["owner@example.com", "cmo@example.com"]);
  });

  it("does not mark detailed email delivery ready until recipients and Resend transport are configured", () => {
    const plan = buildWeeklyReportPlan(
      {
        detailedReportChannel: "email",
        detailedReportRecipientEmails: "owner@example.com",
      },
      "2026-06-10T06:00:00.000Z",
    );

    expect(plan.detailed.channel).toBe("email");
    expect(plan.detailed.deliveryReady).toBe(false);
    expect(plan.detailed.transportConfigured).toBe(false);
  });

  it("routes CrawlObserver findings without spending LLM tokens on known noise", () => {
    expect(
      routeCrawlFinding({
        url: "https://astrogen.com.ua/cdn-cgi/l/email-protection",
        findingType: "technical",
        issueType: "broken_internal",
        statusCode: 404,
      }).action,
    ).toBe("ignore_by_policy");

    expect(
      routeCrawlFinding({
        url: "https://astrogen.com.ua/blog/tag/sinastriya/",
        findingType: "near_duplicate",
        issueType: "near_duplicate",
      }).action,
    ).toBe("ignore_by_policy");

    const missingMetaRoute = routeCrawlFinding({
      url: "https://astrogen.com.ua/blog/category/solar/",
      findingType: "content",
      issueType: "meta_description_missing",
      isIndexable: true,
    });
    expect(missingMetaRoute.action).toBe("create_task");
    expect(missingMetaRoute.routeToAgent).toBe("SEO CMS Technical Fixer");

    const canonicalRoute = routeCrawlFinding({
      url: "https://astrogen.com.ua/blog/?category=stosunky",
      findingType: "canonical",
      issueType: "canonical_mismatch",
    });
    expect(canonicalRoute.action).toBe("create_task");
    expect(canonicalRoute.taskGroupKey).toContain("canonical_mismatch");
  });

  it("exposes report and crawl routing plans as agent tools", async () => {
    const harness = createTestHarness({ manifest });
    harness.setConfig({
      detailedReportChannel: "email",
      detailedReportRecipientEmails: "owner@example.com",
      resendApiKeySecretRef: "00000000-0000-4000-8000-000000000001",
    });
    await plugin.definition.setup(harness.ctx);

    const reportPlan = await harness.executeTool<{
      data: {
        implemented: boolean;
        plan: { telegram: { mode: string }; detailed: { channel: string; deliveryReady: boolean } };
      };
    }>(TOOL_NAMES.weeklyReportPlanGet, {
      anchorIso: "2026-06-10T06:00:00.000Z",
    });
    expect(reportPlan.data.implemented).toBe(true);
    expect(reportPlan.data.plan.telegram.mode).toBe("summary_only");
    expect(reportPlan.data.plan.detailed.channel).toBe("email");
    expect(reportPlan.data.plan.detailed.deliveryReady).toBe(true);

    const dryRun = await harness.executeTool<{
      data: { proof: { dryRun: boolean; provider: string; recipients: string[]; providerMessageId: string | null } };
    }>(TOOL_NAMES.detailedReportEmailSend, {
      subject: "Astrogen detailed SEO report",
      text: "Detailed report body",
      dryRun: true,
    });
    expect(dryRun.data.proof.dryRun).toBe(true);
    expect(dryRun.data.proof.provider).toBe("resend");
    expect(dryRun.data.proof.recipients).toEqual(["owner@example.com"]);
    expect(dryRun.data.proof.providerMessageId).toBeNull();

    const routePlan = await harness.executeTool<{
      data: { implemented: boolean; createTaskCount: number; ignoredCount: number };
    }>(TOOL_NAMES.crawlFindingRoutePlan, {
      findings: [
        {
          url: "https://astrogen.com.ua/blog/category/solar/",
          findingType: "content",
          issueType: "meta_description_missing",
          isIndexable: true,
        },
        {
          url: "https://astrogen.com.ua/blog/tag/sinastriya/",
          findingType: "near_duplicate",
          issueType: "near_duplicate",
        },
      ],
    });
    expect(routePlan.data.implemented).toBe(true);
    expect(routePlan.data.createTaskCount).toBe(1);
    expect(routePlan.data.ignoredCount).toBe(1);
  });

  it("sends detailed report email through Resend without returning the resolved secret", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ id: "email-provider-id" }), { status: 200 });
    }) as typeof fetch;

    try {
      const harness = createTestHarness({ manifest });
      harness.setConfig({
        detailedReportChannel: "email",
        detailedReportRecipientEmails: "owner@example.com",
        resendApiKeySecretRef: "00000000-0000-4000-8000-000000000001",
      });
      await plugin.definition.setup(harness.ctx);

      const result = await harness.executeTool<{
        data: { proof: { dryRun: boolean; providerMessageId: string | null } };
      }>(TOOL_NAMES.detailedReportEmailSend, {
        subject: "Astrogen detailed SEO report",
        text: "Detailed report body",
      });

      expect(result.data.proof.dryRun).toBe(false);
      expect(result.data.proof.providerMessageId).toBe("email-provider-id");
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://api.resend.com/emails");
      expect(calls[0].init?.headers).toMatchObject({
        Authorization: "Bearer resolved:00000000-0000-4000-8000-000000000001",
      });
      expect(JSON.stringify(result.data)).not.toContain("resolved:");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
