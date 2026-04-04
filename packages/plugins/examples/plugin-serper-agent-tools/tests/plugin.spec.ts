import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import { readConfiguredFlatCostCents, searchSerper } from "../src/serper-client.js";

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
  });

  it("reports external spend when flat cost is configured", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        serperApiKeySecretRef: "secret-1",
        flatCostUsdPerSearch: 0.15,
      },
    });
    await plugin.definition.setup(harness.ctx);

    searchSerperMock.mockResolvedValueOnce({
      content: "Serper web search results",
      data: { organic: [{ title: "Example" }] },
    });

    await harness.executeTool(
      TOOL_NAMES.googleSearch,
      { q: "astrogen children astrology", type: "news" },
      { companyId: "company-1", agentId: "agent-1", projectId: "project-1" },
    );

    expect(harness.costs).toEqual([
      expect.objectContaining({
        companyId: "company-1",
        agentId: "agent-1",
        projectId: "project-1",
        provider: "serper.dev",
        model: "google/news",
        costCents: 15,
      }),
    ]);
  });

  it("keeps legacy flatCostCentsPerSearch configs readable", () => {
    expect(
      readConfiguredFlatCostCents({
        flatCostCentsPerSearch: 15,
      }),
    ).toBe(15);
  });
});
