import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import { callExaMcpTool } from "../src/exa-mcp-client.js";

vi.mock("../src/exa-mcp-client.js", async () => {
  const actual = await vi.importActual<typeof import("../src/exa-mcp-client.js")>("../src/exa-mcp-client.js");
  return {
    ...actual,
    callExaMcpTool: vi.fn(),
  };
});

const callExaMcpToolMock = vi.mocked(callExaMcpTool);

describe("plugin-exa-agent-tools", () => {
  beforeEach(() => {
    callExaMcpToolMock.mockReset();
  });

  it("registers Exa-backed tools and forwards web search params", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        exaApiKeySecretRef: "secret-1",
      },
    });
    await plugin.definition.setup(harness.ctx);

    callExaMcpToolMock.mockResolvedValueOnce({
      isError: false,
      content: "Result summary",
      data: { content: [{ type: "text", text: "Result summary" }], structuredContent: null },
    });

    const result = await harness.executeTool(TOOL_NAMES.webSearch, { query: "site:example.com" });

    expect(callExaMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "web_search_exa",
        args: { query: "site:example.com" },
        config: { exaApiKeySecretRef: "secret-1" },
      }),
    );
    expect(result.content).toBe("Result summary");
    expect(harness.costs).toHaveLength(0);
  });

  it("emits one estimated cost event for successful web search when enabled", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        exaApiKeySecretRef: "secret-1",
        costAccountingMode: "estimated_per_request",
        estimatedWebSearchCostUsd: 0.025,
      },
    });
    await plugin.definition.setup(harness.ctx);

    callExaMcpToolMock.mockResolvedValueOnce({
      isError: false,
      content: "Result summary",
      data: { content: [{ type: "text", text: "Result summary" }], structuredContent: null },
    });

    await harness.executeTool(
      TOOL_NAMES.webSearch,
      { query: "site:example.com" },
      {
        companyId: "company-exa",
        projectId: "11111111-1111-1111-1111-111111111111",
        agentId: "22222222-2222-2222-2222-222222222222",
        runId: "33333333-3333-3333-3333-333333333333",
      },
    );

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      companyId: "company-exa",
      projectId: "11111111-1111-1111-1111-111111111111",
      agentId: "22222222-2222-2222-2222-222222222222",
      heartbeatRunId: "33333333-3333-3333-3333-333333333333",
      provider: "exa.ai",
      biller: "exa.ai",
      billingType: "metered_api",
      model: "web-search",
      billingCode: "exa:web-search",
      costCents: 3,
    });
  });

  it("returns tool errors cleanly", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callExaMcpToolMock.mockResolvedValueOnce({
      isError: true,
      content: "Rate limited",
      data: { content: [], structuredContent: null },
    });

    const result = await harness.executeTool(TOOL_NAMES.crawlUrl, { url: "https://example.com" });

    expect(result).toEqual({ error: "Rate limited" });
    expect(harness.costs).toHaveLength(0);
  });

  it("normalizes singular crawl url input into Exa urls[] args", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        exaApiKeySecretRef: "secret-1",
      },
    });
    await plugin.definition.setup(harness.ctx);

    callExaMcpToolMock.mockResolvedValueOnce({
      isError: false,
      content: "Fetched page",
      data: { content: [{ type: "text", text: "Fetched page" }], structuredContent: null },
    });

    const result = await harness.executeTool(TOOL_NAMES.crawlUrl, { url: "https://example.com" });

    expect(callExaMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "crawling_exa",
        args: { urls: ["https://example.com"] },
        config: { exaApiKeySecretRef: "secret-1" },
      }),
    );
    expect(result.content).toBe("Fetched page");
  });
});
