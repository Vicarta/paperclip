import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import { fetchGoogleAdsSearchVolume } from "../src/dataforseo-client.js";

vi.mock("../src/dataforseo-client.js", async () => {
  const actual = await vi.importActual<
    typeof import("../src/dataforseo-client.js")
  >("../src/dataforseo-client.js");
  return {
    ...actual,
    fetchGoogleAdsSearchVolume: vi.fn(),
  };
});

const fetchGoogleAdsSearchVolumeMock = vi.mocked(fetchGoogleAdsSearchVolume);

describe("plugin-dataforseo-agent-tools", () => {
  beforeEach(() => {
    fetchGoogleAdsSearchVolumeMock.mockReset();
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
  });

  it("reports external spend using provider-returned cost", async () => {
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

    await harness.executeTool(
      TOOL_NAMES.googleAdsSearchVolume,
      {
        keywords: ["фінансова натальна карта"],
        location_name: "Ukraine",
        language_name: "Ukrainian",
      },
      { companyId: "company-1", agentId: "agent-1", projectId: "project-1" },
    );

    expect(harness.costs).toEqual([
      expect.objectContaining({
        companyId: "company-1",
        agentId: "agent-1",
        projectId: "project-1",
        provider: "dataforseo.com",
        model: "keywords_data/google_ads/search_volume/live",
        costUsd: 0.075,
      }),
    ]);
  });
});
