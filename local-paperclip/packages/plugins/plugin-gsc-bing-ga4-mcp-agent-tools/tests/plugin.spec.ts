import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import {
  DEFAULT_ALLOWED_GA4_PROPERTY_ID,
  DEFAULT_ALLOWED_SITE_URL,
  TOOL_NAMES,
  VERIFIED_MCP_TOOL_NAMES,
} from "../src/constants.js";
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

  it("allows batch inspection for tenant-owned URLs and injects the allowed site", () => {
    expect(
      prepareGscBingGa4McpArguments({
        toolName: "inspection_batch_inspect",
        args: {
          urls: [
            "https://astrogen.com.ua/blog/natalna-karta",
            "https://www.astrogen.com.ua/experts",
          ],
          cacheMode: "read_write",
          maxAgeHours: 24,
        },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toEqual({
      siteUrl: DEFAULT_ALLOWED_SITE_URL,
      urls: [
        "https://astrogen.com.ua/blog/natalna-karta",
        "https://www.astrogen.com.ua/experts",
      ],
      cacheMode: "read_write",
      maxAgeHours: 24,
    });
  });

  it("rejects batch inspection for non-tenant URLs before reaching MCP", () => {
    expect(() =>
      prepareGscBingGa4McpArguments({
        toolName: "inspection_batch_inspect",
        args: {
          urls: ["https://example.com/blog/natalna-karta"],
        },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toThrow(/inspection URL is not allowed/);
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

  it("allows verified Bing and GA4 read-only tools by default", () => {
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("bing_analytics_query");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("analytics_page_performance");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("analytics_conversion_funnel");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("page_analysis");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("opportunity_matrix");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("inspection_batch_inspect");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("inspection_batch_job_start");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("inspection_batch_job_status");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("inspection_batch_job_results");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("inspection_batch_job_cancel");
    expect(VERIFIED_MCP_TOOL_NAMES).toContain("inspection_cache_stats");

    expect(
      prepareGscBingGa4McpArguments({
        toolName: "analytics_page_performance",
        args: {},
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        allowedGa4PropertyId: DEFAULT_ALLOWED_GA4_PROPERTY_ID,
      }),
    ).toEqual({ propertyId: DEFAULT_ALLOWED_GA4_PROPERTY_ID });

    expect(
      prepareGscBingGa4McpArguments({
        toolName: "page_analysis",
        args: {},
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        allowedGa4PropertyId: DEFAULT_ALLOWED_GA4_PROPERTY_ID,
      }),
    ).toEqual({
      gscSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      ga4PropertyId: DEFAULT_ALLOWED_GA4_PROPERTY_ID,
    });
  });

  it("rejects attempts to query another GA4 property", () => {
    expect(() =>
      prepareGscBingGa4McpArguments({
        toolName: "analytics_page_performance",
        args: { propertyId: "123456" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        allowedGa4PropertyId: DEFAULT_ALLOWED_GA4_PROPERTY_ID,
      }),
    ).toThrow(/not allowed/);
  });

  it("rejects attempts to query another site or GA4 property through page_analysis", () => {
    expect(() =>
      prepareGscBingGa4McpArguments({
        toolName: "page_analysis",
        args: { gscSiteUrl: "sc-domain:example.com" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        allowedGa4PropertyId: DEFAULT_ALLOWED_GA4_PROPERTY_ID,
      }),
    ).toThrow(/not allowed/);

    expect(() =>
      prepareGscBingGa4McpArguments({
        toolName: "page_analysis",
        args: { ga4PropertyId: "123456" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
        allowedGa4PropertyId: DEFAULT_ALLOWED_GA4_PROPERTY_ID,
      }),
    ).toThrow(/not allowed/);
  });

  it("keeps mutating MCP tools out of the default allowlist", () => {
    expect(VERIFIED_MCP_TOOL_NAMES).not.toContain("sites_add");
    expect(VERIFIED_MCP_TOOL_NAMES).not.toContain("sites_delete");
    expect(VERIFIED_MCP_TOOL_NAMES).not.toContain("sitemaps_submit");
    expect(VERIFIED_MCP_TOOL_NAMES).not.toContain("bing_index_now");
    expect(VERIFIED_MCP_TOOL_NAMES).not.toContain("bing_sitemaps_submit");
  });

  it("allows async inspection job start for tenant-owned URLs and injects the allowed site", () => {
    expect(
      prepareGscBingGa4McpArguments({
        toolName: "inspection_batch_job_start",
        args: {
          urls: ["https://astrogen.com.ua/blog/natalna-karta"],
          cacheMode: "read_write",
          maxAgeHours: 24,
          forceRefresh: false,
        },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toEqual({
      siteUrl: DEFAULT_ALLOWED_SITE_URL,
      urls: ["https://astrogen.com.ua/blog/natalna-karta"],
      cacheMode: "read_write",
      maxAgeHours: 24,
      forceRefresh: false,
    });
  });

  it("allows async inspection job status and paged results by job id", () => {
    expect(
      prepareGscBingGa4McpArguments({
        toolName: "inspection_batch_job_status",
        args: { jobId: "job-123" },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toEqual({ jobId: "job-123" });

    expect(
      prepareGscBingGa4McpArguments({
        toolName: "inspection_batch_job_results",
        args: { jobId: "job-123", offset: 0, limit: 100 },
        allowedSiteUrl: DEFAULT_ALLOWED_SITE_URL,
      }),
    ).toEqual({ jobId: "job-123", offset: 0, limit: 100 });
  });
});
