import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  fetchGoogleAdsKeywordsForKeywords,
  fetchGoogleAdsSearchVolume,
} from "../src/dataforseo-client.js";

vi.mock("../src/dataforseo-client.js", async () => {
  const actual = await vi.importActual<
    typeof import("../src/dataforseo-client.js")
  >("../src/dataforseo-client.js");
  return {
    ...actual,
    fetchGoogleAdsKeywordsForKeywords: vi.fn(),
    fetchGoogleAdsSearchVolume: vi.fn(),
  };
});

const fetchGoogleAdsKeywordsForKeywordsMock = vi.mocked(fetchGoogleAdsKeywordsForKeywords);
const fetchGoogleAdsSearchVolumeMock = vi.mocked(fetchGoogleAdsSearchVolume);

describe("plugin-dataforseo-agent-tools", () => {
  beforeEach(() => {
    fetchGoogleAdsKeywordsForKeywordsMock.mockReset();
    fetchGoogleAdsSearchVolumeMock.mockReset();
  });

  it("registers the DataForSEO-backed keyword ideas tool", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        dataforseoApiLoginSecretRef: "secret-login",
        dataforseoApiPasswordSecretRef: "secret-password",
      },
    });
    await plugin.definition.setup(harness.ctx);

    fetchGoogleAdsKeywordsForKeywordsMock.mockResolvedValueOnce({
      content: "DataForSEO Google Ads keyword ideas",
      data: { tasks: [{ result: [{ keyword: "натальна карта онлайн" }] }] },
      actualCostUsd: 0.075,
    });

    const result = await harness.executeTool(
      TOOL_NAMES.googleAdsKeywordsForKeywords,
      {
        keywords: ["натальна карта"],
        location_name: "Ukraine",
        language_name: "Ukrainian",
        sort_by: "search_volume",
      },
      {
        companyId: "company-dataforseo",
        projectId: "11111111-1111-1111-1111-111111111111",
        agentId: "22222222-2222-2222-2222-222222222222",
        runId: "33333333-3333-3333-3333-333333333333",
      },
    );

    expect(fetchGoogleAdsKeywordsForKeywordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          keywords: ["натальна карта"],
          location_name: "Ukraine",
          language_name: "Ukrainian",
          sort_by: "search_volume",
        },
        config: {
          dataforseoApiLoginSecretRef: "secret-login",
          dataforseoApiPasswordSecretRef: "secret-password",
        },
      }),
    );
    expect(result.content).toBe("DataForSEO Google Ads keyword ideas");
    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      companyId: "company-dataforseo",
      projectId: "11111111-1111-1111-1111-111111111111",
      agentId: "22222222-2222-2222-2222-222222222222",
      heartbeatRunId: "33333333-3333-3333-3333-333333333333",
      provider: "dataforseo.com",
      biller: "dataforseo.com",
      billingType: "metered_api",
      model: "google_ads_keywords_for_keywords",
      billingCode: TOOL_NAMES.googleAdsKeywordsForKeywords,
      costCents: 8,
    });
  });

  it("registers the DataForSEO-backed search volume tool", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        dataforseoApiLoginSecretRef: "secret-login",
        dataforseoApiPasswordSecretRef: "secret-password",
      },
    });
    await plugin.definition.setup(harness.ctx);

    fetchGoogleAdsSearchVolumeMock.mockResolvedValueOnce({
      content: "DataForSEO Google Ads search volume results",
      data: { tasks: [{ result: [{ keyword: "фінансова натальна карта" }] }] },
      actualCostUsd: 0.075,
    });

    const result = await harness.executeTool(TOOL_NAMES.googleAdsSearchVolume, {
      keywords: ["фінансова натальна карта"],
      location_name: "Ukraine",
      language_name: "Ukrainian",
    }, {
      companyId: "company-dataforseo",
      projectId: "11111111-1111-1111-1111-111111111111",
      agentId: "22222222-2222-2222-2222-222222222222",
      runId: "33333333-3333-3333-3333-333333333333",
    });

    expect(fetchGoogleAdsSearchVolumeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          keywords: ["фінансова натальна карта"],
          location_name: "Ukraine",
          language_name: "Ukrainian",
        },
        config: {
          dataforseoApiLoginSecretRef: "secret-login",
          dataforseoApiPasswordSecretRef: "secret-password",
        },
      }),
    );
    expect(result.content).toBe("DataForSEO Google Ads search volume results");
    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      companyId: "company-dataforseo",
      projectId: "11111111-1111-1111-1111-111111111111",
      agentId: "22222222-2222-2222-2222-222222222222",
      heartbeatRunId: "33333333-3333-3333-3333-333333333333",
      provider: "dataforseo.com",
      biller: "dataforseo.com",
      billingType: "metered_api",
      model: "google_ads_search_volume",
      billingCode: TOOL_NAMES.googleAdsSearchVolume,
      costCents: 8,
    });
  });

  it("does not emit a cost event when provider cost is zero", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        dataforseoApiLoginSecretRef: "secret-login",
        dataforseoApiPasswordSecretRef: "secret-password",
      },
    });
    await plugin.definition.setup(harness.ctx);

    fetchGoogleAdsSearchVolumeMock.mockResolvedValueOnce({
      content: "No provider cost",
      data: { tasks: [] },
      actualCostUsd: 0,
    });

    const result = await harness.executeTool(TOOL_NAMES.googleAdsSearchVolume, {
      keywords: ["натальна карта фінанси"],
    });

    expect(result.content).toBe("No provider cost");
    expect(harness.costs).toHaveLength(0);
  });

  it("emits amount micros for sub-cent provider-reported costs", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        dataforseoApiLoginSecretRef: "secret-login",
        dataforseoApiPasswordSecretRef: "secret-password",
      },
    });
    await plugin.definition.setup(harness.ctx);

    fetchGoogleAdsSearchVolumeMock.mockResolvedValueOnce({
      content: "Sub-cent provider cost",
      data: { tasks: [] },
      actualCostUsd: 0.001,
    });

    await harness.executeTool(TOOL_NAMES.googleAdsSearchVolume, {
      keywords: ["натальна карта фінанси"],
    });

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      provider: "dataforseo.com",
      billingCode: TOOL_NAMES.googleAdsSearchVolume,
      costCents: 0,
      amountMicros: 1000,
    });
  });
});
