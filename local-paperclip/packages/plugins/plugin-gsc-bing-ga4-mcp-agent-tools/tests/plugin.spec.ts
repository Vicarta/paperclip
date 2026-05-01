import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { DEFAULT_ALLOWED_SITE_URL, TOOL_NAMES } from "../src/constants.js";
import {
  callGscBingGa4McpTool,
  listGscBingGa4McpTools,
  prepareGscBingGa4McpArguments,
} from "../src/gsc-bing-ga4-mcp-client.js";

vi.mock("../src/gsc-bing-ga4-mcp-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/gsc-bing-ga4-mcp-client.js")>(
      "../src/gsc-bing-ga4-mcp-client.js",
    );
  return {
    ...actual,
    callGscBingGa4McpTool: vi.fn(),
    listGscBingGa4McpTools: vi.fn(),
  };
});

const callGscBingGa4McpToolMock = vi.mocked(callGscBingGa4McpTool);
const listGscBingGa4McpToolsMock = vi.mocked(listGscBingGa4McpTools);

describe("plugin-gsc-bing-ga4-mcp-agent-tools", () => {
  beforeEach(() => {
    callGscBingGa4McpToolMock.mockReset();
    listGscBingGa4McpToolsMock.mockReset();
  });

  it("registers allowlisted wrapper tools and forwards through backend config", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        gscBingGa4McpTokenSecretRef: "secret-gsc",
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      },
    });
    await plugin.definition.setup(harness.ctx);

    callGscBingGa4McpToolMock.mockResolvedValueOnce({
      content: "top queries",
      data: { structuredContent: { rows: [] }, content: [] },
      isError: false,
    });

    const result = await harness.executeTool(TOOL_NAMES.analyticsTopQueries, {
      startDate: "2026-04-01",
      endDate: "2026-04-28",
    });

    expect(callGscBingGa4McpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "analytics_top_queries",
        args: {
          startDate: "2026-04-01",
          endDate: "2026-04-28",
        },
        config: {
          gscBingGa4McpTokenSecretRef: "secret-gsc",
          allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        },
      }),
    );
    expect(result.content).toBe("top queries");
  });

  it("registers a generic allowlisted call tool", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callGscBingGa4McpToolMock.mockResolvedValueOnce({
      content: "inspection",
      data: { structuredContent: null, content: [] },
      isError: false,
    });

    await harness.executeTool(TOOL_NAMES.callTool, {
      toolName: "inspection_inspect",
      arguments: { inspectionUrl: "https://astrogen.com.ua/" },
    });

    expect(callGscBingGa4McpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "inspection_inspect",
        args: { inspectionUrl: "https://astrogen.com.ua/" },
      }),
    );
  });

  it("lists only allowlisted MCP tools", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    listGscBingGa4McpToolsMock.mockResolvedValueOnce({
      content: "[]",
      data: { tools: [] },
    });

    const result = await harness.executeTool(TOOL_NAMES.listTools, {});

    expect(listGscBingGa4McpToolsMock).toHaveBeenCalledOnce();
    expect(result.content).toBe("[]");
  });

  it("injects the configured site for site-scoped tools", () => {
    expect(
      prepareGscBingGa4McpArguments({
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
      prepareGscBingGa4McpArguments({
        toolName: "analytics_query",
        args: { siteUrl: "sc-domain:example.com" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toThrow(/not allowed/);
  });

  it("rejects non-verified MCP tool names", () => {
    expect(() =>
      prepareGscBingGa4McpArguments({
        toolName: "dangerous_unverified_tool",
        args: {},
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toThrow(/not allowed/);
  });

  it("allows future verified Bing or GA4 tools only through backend allowlist config", () => {
    expect(
      prepareGscBingGa4McpArguments({
        toolName: "ga4_report_query",
        args: { propertyId: "123456" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        allowedToolNames: ["ga4_report_query"],
      }),
    ).toEqual({ propertyId: "123456" });
  });
});
