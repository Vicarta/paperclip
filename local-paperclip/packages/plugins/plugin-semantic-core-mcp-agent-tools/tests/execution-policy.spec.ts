import { describe, expect, it } from "vitest";
import { enforceSemanticCoreExecutionPolicy } from "../src/execution-policy.js";

describe("semantic core execution policy", () => {
  it("defaults semantic and trend execution to no-spend modes", () => {
    expect(
      enforceSemanticCoreExecutionPolicy({
        toolName: "run_layer",
        args: { project_id: "astrogen-ukraine", layer: "audience_need_intent" },
        config: {},
      }),
    ).toMatchObject({ mode: "mock" });
    expect(
      enforceSemanticCoreExecutionPolicy({
        toolName: "generate_trend_topic_report",
        args: { project_id: "astrogen-audience-trends-ukraine" },
        config: {},
      }),
    ).toMatchObject({ mode: "fixture" });
  });

  it("rejects provider and trend live calls while operator gates are disabled", () => {
    expect(() =>
      enforceSemanticCoreExecutionPolicy({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "audience_need_intent",
          mode: "provider",
          candidate_keywords: ["one phrase"],
        },
        config: {},
      }),
    ).toThrow("SEMANTIC_CORE_PROVIDER_EXECUTION_DISABLED");
    expect(() =>
      enforceSemanticCoreExecutionPolicy({
        toolName: "generate_trend_topic_report",
        args: { project_id: "astrogen-audience-trends-ukraine", mode: "live" },
        config: {},
      }),
    ).toThrow("SEMANTIC_CORE_TREND_LIVE_DISABLED");
  });

  it("allows no-spend provider cache reads with economical enrichments", () => {
    expect(
      enforceSemanticCoreExecutionPolicy({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "audience_need_intent",
          mode: "live",
        },
        config: { providerExecutionPolicy: "read_only" },
      }),
    ).toMatchObject({
      mode: "provider",
      provider_cache_mode: "read_only",
      provider_queue: "standard",
      include_search_intent: false,
      include_content_parsing: false,
    });
  });

  it("bounds approved paid execution to exact candidate batches", () => {
    const config = { providerExecutionPolicy: "approved_candidate_batch" } as const;
    expect(() =>
      enforceSemanticCoreExecutionPolicy({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "audience_need_intent",
          mode: "provider",
          provider_cache_mode: "read_write",
        },
        config,
      }),
    ).toThrow("SEMANTIC_CORE_CANDIDATE_BATCH_REQUIRED");
    expect(() =>
      enforceSemanticCoreExecutionPolicy({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "audience_need_intent",
          mode: "provider",
          provider_cache_mode: "refresh",
          candidate_keywords: ["one phrase"],
        },
        config,
      }),
    ).toThrow("SEMANTIC_CORE_PROVIDER_CACHE_MODE_FORBIDDEN");
    expect(() =>
      enforceSemanticCoreExecutionPolicy({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "audience_need_intent",
          mode: "provider",
          candidate_keywords: ["one phrase"],
          include_search_intent: true,
        },
        config,
      }),
    ).toThrow("SEMANTIC_CORE_SEARCH_INTENT_DISABLED");
  });

  it("forces cached, bounded trend research when live is approved", () => {
    expect(
      enforceSemanticCoreExecutionPolicy({
        toolName: "generate_trend_topic_report",
        args: {
          project_id: "astrogen-audience-trends-ukraine",
          mode: "live",
        },
        config: { trendLiveExecutionEnabled: true },
      }),
    ).toMatchObject({
      mode: "live",
      constraints: { max_research_queries: 6, max_sources: 20 },
      cache_policy: { scope: "private_project", strategy: "use_cache" },
    });
    expect(() =>
      enforceSemanticCoreExecutionPolicy({
        toolName: "generate_trend_topic_report",
        args: {
          project_id: "astrogen-audience-trends-ukraine",
          mode: "live",
          cache_policy: { strategy: "refresh" },
        },
        config: { trendLiveExecutionEnabled: true },
      }),
    ).toThrow("SEMANTIC_CORE_TREND_CACHE_REFRESH_DISABLED");
  });
});
