import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import { searchSerper } from "../src/serper-client.js";

vi.mock("../src/serper-client.js", async () => {
  const actual = await vi.importActual<typeof import("../src/serper-client.js")>(
    "../src/serper-client.js",
  );
  return {
    ...actual,
    searchSerper: vi.fn(),
  };
});

const searchSerperMock = vi.mocked(searchSerper);

describe("plugin-serper-agent-tools", () => {
  beforeEach(() => {
    searchSerperMock.mockReset();
  });

  it("registers the Serper-backed search tool", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        serperApiKeySecretRef: "secret-1",
      },
    });
    await plugin.definition.setup(harness.ctx);

    searchSerperMock.mockResolvedValueOnce({
      content: "Serper web search results",
      data: { organic: [{ title: "Example" }] },
    });

    const result = await harness.executeTool(TOOL_NAMES.googleSearch, {
      q: "astrogen фінансова натальна карта",
    });

    expect(searchSerperMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { q: "astrogen фінансова натальна карта" },
        config: { serperApiKeySecretRef: "secret-1" },
      }),
    );
    expect(result.content).toBe("Serper web search results");
    expect(harness.costs).toHaveLength(0);
  });

  it("emits one estimated cost event for successful web search when enabled", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        serperApiKeySecretRef: "secret-1",
        costAccountingMode: "estimated_per_request",
        estimatedSearchCostUsd: 0.01,
      },
    });
    await plugin.definition.setup(harness.ctx);

    searchSerperMock.mockResolvedValueOnce({
      content: "Serper web search results",
      data: { organic: [{ title: "Example" }] },
    });

    await harness.executeTool(
      TOOL_NAMES.googleSearch,
      {
        q: "китайський гороскоп",
        gl: "ua",
        hl: "uk",
      },
      {
        companyId: "company-serper",
        projectId: "11111111-1111-1111-1111-111111111111",
        agentId: "22222222-2222-2222-2222-222222222222",
        runId: "33333333-3333-3333-3333-333333333333",
      },
    );

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      companyId: "company-serper",
      projectId: "11111111-1111-1111-1111-111111111111",
      agentId: "22222222-2222-2222-2222-222222222222",
      heartbeatRunId: "33333333-3333-3333-3333-333333333333",
      provider: "serper.dev",
      biller: "serper.dev",
      billingType: "metered_api",
      model: "google_search",
      billingCode: "serper:google-search:search",
      costCents: 1,
    });
  });

  it("accumulates legacy sub-cent flat Serper search costs before writing a cent", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        serperApiKeySecretRef: "secret-1",
        flatCostUsdPerSearch: 0.001,
      },
    });
    await plugin.definition.setup(harness.ctx);

    searchSerperMock.mockResolvedValue({
      content: "Serper web search results",
      data: { organic: [{ title: "Example" }] },
    });

    for (let index = 0; index < 10; index += 1) {
      await harness.executeTool(
        TOOL_NAMES.googleSearch,
        { q: `китайський гороскоп ${index}` },
        {
          companyId: "company-serper",
          projectId: "11111111-1111-1111-1111-111111111111",
          agentId: "22222222-2222-2222-2222-222222222222",
          runId: "33333333-3333-3333-3333-333333333333",
        },
      );
    }

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      provider: "serper.dev",
      billingCode: "serper:google-search:search",
      costCents: 1,
    });
  });

  it("does not emit cost when Serper call fails", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        serperApiKeySecretRef: "secret-1",
        costAccountingMode: "estimated_per_request",
        estimatedSearchCostUsd: 0.01,
      },
    });
    await plugin.definition.setup(harness.ctx);

    searchSerperMock.mockRejectedValueOnce(new Error("Rate limited"));

    await expect(
      harness.executeTool(TOOL_NAMES.googleSearch, { q: "китайський гороскоп" }),
    ).rejects.toThrow("Rate limited");
    expect(harness.costs).toHaveLength(0);
  });
});
