import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { DEFAULT_ALLOWED_SITE_URL, TOOL_NAMES } from "../src/constants.js";
import {
  callSearchConsoleMcpTool,
  listSearchConsoleMcpTools,
  prepareSearchConsoleMcpArguments,
} from "../src/search-console-mcp-client.js";

vi.mock("../src/search-console-mcp-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/search-console-mcp-client.js")>(
      "../src/search-console-mcp-client.js",
    );
  return {
    ...actual,
    callSearchConsoleMcpTool: vi.fn(),
    listSearchConsoleMcpTools: vi.fn(),
  };
});

const callSearchConsoleMcpToolMock = vi.mocked(callSearchConsoleMcpTool);
const listSearchConsoleMcpToolsMock = vi.mocked(listSearchConsoleMcpTools);

describe("plugin-search-console-mcp-agent-tools", () => {
  beforeEach(() => {
    callSearchConsoleMcpToolMock.mockReset();
    listSearchConsoleMcpToolsMock.mockReset();
  });

  it("registers allowlisted wrapper tools and forwards through backend config", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        searchConsoleMcpTokenSecretRef: "secret-gsc",
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      },
    });
    await plugin.definition.setup(harness.ctx);

    callSearchConsoleMcpToolMock.mockResolvedValueOnce({
      content: "top queries",
      data: { structuredContent: { rows: [] }, content: [] },
      isError: false,
    });

    const result = await harness.executeTool(TOOL_NAMES.analyticsTopQueries, {
      startDate: "2026-04-01",
      endDate: "2026-04-28",
    });

    expect(callSearchConsoleMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "analytics_top_queries",
        args: {
          startDate: "2026-04-01",
          endDate: "2026-04-28",
        },
        config: {
          searchConsoleMcpTokenSecretRef: "secret-gsc",
          allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        },
      }),
    );
    expect(result.content).toBe("top queries");
  });

  it("registers a generic allowlisted call tool", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callSearchConsoleMcpToolMock.mockResolvedValueOnce({
      content: "inspection",
      data: { structuredContent: null, content: [] },
      isError: false,
    });

    await harness.executeTool(TOOL_NAMES.callTool, {
      toolName: "inspection_inspect",
      arguments: { inspectionUrl: "https://astrogen.com.ua/" },
    });

    expect(callSearchConsoleMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "inspection_inspect",
        args: { inspectionUrl: "https://astrogen.com.ua/" },
      }),
    );
  });

  it("lists only allowlisted MCP tools", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    listSearchConsoleMcpToolsMock.mockResolvedValueOnce({
      content: "[]",
      data: { tools: [] },
    });

    const result = await harness.executeTool(TOOL_NAMES.listTools, {});

    expect(listSearchConsoleMcpToolsMock).toHaveBeenCalledOnce();
    expect(result.content).toBe("[]");
  });

  it("injects the configured site for site-scoped tools", () => {
    expect(
      prepareSearchConsoleMcpArguments({
        toolName: "analytics_query",
        args: { query: "натальна карта" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toEqual({
      query: "натальна карта",
      siteUrl: DEFAULT_ALLOWED_SITE_URL,
    });
  });

  it("rejects attempts to query another Search Console site", () => {
    expect(() =>
      prepareSearchConsoleMcpArguments({
        toolName: "analytics_query",
        args: { siteUrl: "sc-domain:example.com" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toThrow(/not allowed/);
  });

  it("rejects non-verified MCP tool names", () => {
    expect(() =>
      prepareSearchConsoleMcpArguments({
        toolName: "dangerous_unverified_tool",
        args: {},
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toThrow(/not allowed/);
  });
});
