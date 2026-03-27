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
  });
});
