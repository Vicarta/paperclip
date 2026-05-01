import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { runBigQueryQuery } from "../src/bigquery-client.js";
import { TOOL_NAMES } from "../src/constants.js";

vi.mock("../src/bigquery-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/bigquery-client.js")>(
      "../src/bigquery-client.js",
    );
  return {
    ...actual,
    runBigQueryQuery: vi.fn(),
  };
});

const runBigQueryQueryMock = vi.mocked(runBigQueryQuery);

const pluginConfig = {
  bigQueryProjectId: "diskinternals-test",
  bigQueryDatasetId: "growth",
  bigQueryAccessTokenSecretRef: "secret-token",
};

describe("plugin-diskinternals-bigquery-growth", () => {
  beforeEach(() => {
    runBigQueryQueryMock.mockReset();
  });

  it("registers report tools and runs allowlisted SELECTs", async () => {
    const harness = createTestHarness({ manifest, config: pluginConfig });
    await plugin.definition.setup(harness.ctx);

    runBigQueryQueryMock.mockResolvedValueOnce({
      rows: [{ opportunity_id: "opp-1", page_action_score: 42 }],
      totalRows: 1,
      totalBytesProcessed: "1024",
      cacheHit: false,
      jobReference: { jobId: "job-1" },
      dryRun: false,
    });

    const result = await harness.executeTool(TOOL_NAMES.getUrlGrowthOpportunityQueue, {
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      limit: 10,
    });

    expect(runBigQueryQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ bigQueryProjectId: "diskinternals-test" }),
        options: expect.objectContaining({
          query: expect.stringContaining("FROM `diskinternals-test.growth.mart_growth_opportunities`"),
          parameters: expect.objectContaining({ limit: 10 }),
        }),
      }),
    );
    expect(result.data).toMatchObject({ row_count: 1, source: "mart_growth_opportunities" });
  });

  it("records opportunity decisions with validated action types", async () => {
    const harness = createTestHarness({ manifest, config: pluginConfig });
    await plugin.definition.setup(harness.ctx);

    runBigQueryQueryMock.mockResolvedValueOnce({
      rows: [],
      totalRows: 0,
      totalBytesProcessed: "0",
      cacheHit: null,
      jobReference: { jobId: "job-2" },
      dryRun: false,
    });

    await harness.executeTool(TOOL_NAMES.recordOpportunityDecision, {
      opportunity_id: "opp-1",
      action_type: "seo_refresh",
      owner_lane: "SEO",
      decision_status: "accepted",
      source_opportunity_ids: ["opp-1", "opp-2"],
    });

    expect(runBigQueryQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          query: expect.stringContaining("INSERT INTO `diskinternals-test.growth.opportunity_decisions`"),
          parameters: expect.objectContaining({
            actionType: "seo_refresh",
            sourceOpportunityIdsCsv: "opp-1,opp-2",
          }),
        }),
      }),
    );
  });

  it("rejects unsupported decision action types", async () => {
    const harness = createTestHarness({ manifest, config: pluginConfig });
    await plugin.definition.setup(harness.ctx);

    await expect(harness.executeTool(TOOL_NAMES.recordOpportunityDecision, {
      action_type: "raw_sql",
    })).rejects.toThrow(/Unsupported opportunity action type/);
  });
});
