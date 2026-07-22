import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  callCrawlObserverApi,
  preparePagesQuery,
  prepareReadEndpointRequest,
  prepareSessionsQuery,
  prepareStartCrawlBody,
  buildSessionPath,
  normalizeSessionInventory,
} from "../src/crawlobserver-client.js";

vi.mock("../src/crawlobserver-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/crawlobserver-client.js")>(
      "../src/crawlobserver-client.js",
    );
  return {
    ...actual,
    callCrawlObserverApi: vi.fn(),
  };
});

const callCrawlObserverApiMock = vi.mocked(callCrawlObserverApi);

describe("plugin-crawlobserver-agent-tools", () => {
  beforeEach(() => {
    callCrawlObserverApiMock.mockReset();
  });

  it("declares sessionId for every session-scoped inventory tool", () => {
    const sessionTools = [
      TOOL_NAMES.getSessionQuality,
      TOOL_NAMES.listPages,
      TOOL_NAMES.listLinks,
      TOOL_NAMES.listInternalLinks,
      TOOL_NAMES.getSitemapUrls,
      TOOL_NAMES.getResourceChecks,
      TOOL_NAMES.getPageIssues,
      TOOL_NAMES.getRedirectPages,
      TOOL_NAMES.getNearDuplicates,
      TOOL_NAMES.getStructuredData,
    ];

    for (const toolName of sessionTools) {
      const tool = manifest.tools?.find((candidate) => candidate.name === toolName);
      expect(tool?.parametersSchema).toMatchObject({
        properties: { sessionId: { type: "string" } },
        required: ["sessionId"],
      });
    }
  });

  it("declares a bounded list-sessions schema", () => {
    const tool = manifest.tools?.find(
      (candidate) => candidate.name === TOOL_NAMES.listSessions,
    );
    expect(tool?.parametersSchema).toEqual({
      type: "object",
      properties: {
        project_id: expect.objectContaining({ type: "string" }),
        limit: { type: "number" },
        offset: { type: "number" },
        search: { type: "string" },
      },
      additionalProperties: false,
    });
  });

  it("normalizes CrawlObserver's provider session_id alias", () => {
    expect(buildSessionPath({
      params: { session_id: "provider-session-1" },
      suffix: "/pages",
    })).toBe("/api/sessions/provider-session-1/pages");
  });

  it("registers the health tool and forwards through backend config", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        crawlObserverApiKeySecretRef: "secret-co",
      },
    });
    await plugin.definition.setup(harness.ctx);

    callCrawlObserverApiMock.mockResolvedValueOnce({
      content: "{\"ok\":true}",
      data: { ok: true },
    });

    const result = await harness.executeTool(TOOL_NAMES.healthCheck, {});

    expect(callCrawlObserverApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { crawlObserverApiKeySecretRef: "secret-co" },
        request: { method: "GET", path: "/api/health" },
      }),
    );
    expect(result.data).toEqual({ ok: true });
  });

  it("does not allow start-crawl unless mutating tools are enabled", () => {
    expect(() =>
      prepareStartCrawlBody({
        params: { seeds: ["https://astrogen.com.ua"] },
        config: { allowMutatingTools: false },
      }),
    ).toThrow(/mutating tools are disabled/);
  });

  it("prepares a start-crawl body when mutating tools are enabled", () => {
    expect(
      prepareStartCrawlBody({
        params: {
          seeds: ["https://astrogen.com.ua"],
          max_pages: 100,
          project_id: "project-1",
          ignored: "nope",
        },
        config: {
          allowMutatingTools: true,
          allowedProjectId: "project-1",
        },
      }),
    ).toEqual({
      seeds: ["https://astrogen.com.ua"],
      max_pages: 100,
      project_id: "project-1",
    });
  });

  it("rejects a crawl for another configured project", () => {
    expect(() =>
      prepareStartCrawlBody({
        params: {
          seeds: ["https://astrogen.com.ua"],
          project_id: "other-project",
        },
        config: {
          allowMutatingTools: true,
          allowedProjectId: "project-1",
        },
      }),
    ).toThrow(/project_id is not allowed/);
  });

  it("injects the company-scoped project into session inventory", () => {
    expect(
      prepareSessionsQuery({
        params: { limit: 5, offset: 0 },
        config: {
          allowedProjectId: "project-1",
          maxPageLimit: 100,
        },
      }),
    ).toEqual({
      limit: 5,
      offset: 0,
      project_id: "project-1",
    });

    expect(() =>
      prepareSessionsQuery({
        params: { project_id: "other-project" },
        config: { allowedProjectId: "project-1" },
      }),
    ).toThrow(/project_id is not allowed/);
  });

  it("normalizes provider session inventory into a compact camelCase DTO", () => {
    expect(normalizeSessionInventory({
      sessions: [{
        ID: "session-1",
        ProjectID: "project-1",
        Label: "Full crawl",
        Status: "completed",
        StartedAt: "2026-07-18T19:54:26Z",
        FinishedAt: "2026-07-18T19:57:59Z",
        PagesCrawled: 191,
        SeedURLs: ["https://astrogen.com.ua/"],
        Config: "large provider payload must not leak",
        quality: {
          trusted: true,
          status: "trusted",
          score: 90,
          is_full_crawl: true,
          baseline_session_id: "baseline-1",
          summary: "Crawl data is trusted.",
        },
      }],
      total: 1,
    })).toEqual({
      sessions: [{
        sessionId: "session-1",
        projectId: "project-1",
        label: "Full crawl",
        status: "completed",
        startedAt: "2026-07-18T19:54:26Z",
        finishedAt: "2026-07-18T19:57:59Z",
        pagesCrawled: 191,
        seedUrls: ["https://astrogen.com.ua/"],
        isQueued: false,
        isRunning: false,
        quality: {
          trusted: true,
          status: "trusted",
          score: 90,
          isFullCrawl: true,
          baselineSessionId: "baseline-1",
          summary: "Crawl data is trusted.",
        },
      }],
      total: 1,
    });
  });

  it("returns compact list-sessions data without the raw Config payload", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        crawlObserverApiKeySecretRef: "secret-co",
        allowedProjectId: "project-1",
      },
    });
    await plugin.definition.setup(harness.ctx);
    callCrawlObserverApiMock.mockResolvedValueOnce({
      content: "raw",
      data: {
        sessions: [{ ID: "session-1", ProjectID: "project-1", Config: "large" }],
        total: 1,
      },
    });

    const result = await harness.executeTool(TOOL_NAMES.listSessions, { limit: 5 });

    expect(result.data).toMatchObject({
      total: 1,
      sessions: [{ sessionId: "session-1", projectId: "project-1" }],
    });
    expect(result.content).not.toContain("Config");
  });

  it("registers start-crawl as a gated backend call", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        crawlObserverApiKeySecretRef: "secret-co",
        allowMutatingTools: true,
      },
    });
    await plugin.definition.setup(harness.ctx);

    callCrawlObserverApiMock.mockResolvedValueOnce({
      content: "{\"session_id\":\"abc\"}",
      data: { session_id: "abc", status: "started" },
    });

    await harness.executeTool(TOOL_NAMES.startCrawl, {
      seeds: ["https://astrogen.com.ua"],
      max_pages: 50,
    });

    expect(callCrawlObserverApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          method: "POST",
          path: "/api/crawl",
          body: {
            seeds: ["https://astrogen.com.ua"],
            max_pages: 50,
          },
        },
      }),
    );
  });

  it("registers resource-checks with image filters", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        crawlObserverApiKeySecretRef: "secret-co",
        maxPageLimit: 100,
      },
    });
    await plugin.definition.setup(harness.ctx);

    callCrawlObserverApiMock.mockResolvedValueOnce({
      content: "{\"items\":[]}",
      data: { items: [] },
    });

    await harness.executeTool(TOOL_NAMES.getResourceChecks, {
      sessionId: "session-1",
      resource_type: "image",
      status_code: ">=400",
      is_internal: true,
      limit: 250,
      offset: 0,
      ignored: "nope",
    });

    expect(callCrawlObserverApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          method: "GET",
          path: "/api/sessions/session-1/resource-checks",
          query: {
            resource_type: "image",
            status_code: ">=400",
            is_internal: true,
            limit: 100,
            offset: 0,
          },
        },
      }),
    );
  });

  it("registers page-issues with severity and issue type filters", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        crawlObserverApiKeySecretRef: "secret-co",
        maxPageLimit: 100,
      },
    });
    await plugin.definition.setup(harness.ctx);

    callCrawlObserverApiMock.mockResolvedValueOnce({
      content: "{\"items\":[]}",
      data: { items: [] },
    });

    await harness.executeTool(TOOL_NAMES.getPageIssues, {
      sessionId: "session-1",
      severity: "error",
      issue_type: "soft_404",
      url: "/blog/",
      limit: 250,
      offset: 0,
      ignored: "nope",
    });

    expect(callCrawlObserverApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          method: "GET",
          path: "/api/sessions/session-1/page-issues",
          query: {
            severity: "error",
            issue_type: "soft_404",
            url: "/blog/",
            limit: 100,
            offset: 0,
          },
        },
      }),
    );
  });

  it("registers session-quality as the SEO trust gate endpoint", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        crawlObserverApiKeySecretRef: "secret-co",
      },
    });
    await plugin.definition.setup(harness.ctx);

    callCrawlObserverApiMock.mockResolvedValueOnce({
      content: "{\"trusted\":true,\"status\":\"trusted\"}",
      data: { trusted: true, status: "trusted" },
    });

    const result = await harness.executeTool(TOOL_NAMES.getSessionQuality, {
      sessionId: "session-1",
    });

    expect(callCrawlObserverApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          method: "GET",
          path: "/api/sessions/session-1/quality",
        },
      }),
    );
    expect(result.data).toEqual({ trusted: true, status: "trusted" });
  });

  it("passes CrawlObserver HTML page filters and page_type sorting", async () => {
    expect(
      preparePagesQuery({
        params: {
          page_type: "html",
          sort: "page_type",
          order: "asc",
          internal_links_in: 10,
          limit: 250,
          offset: 0,
        },
        config: { maxPageLimit: 100 },
      }),
    ).toEqual({
      page_type: "html",
      sort: "page_type",
      order: "asc",
      limit: 100,
      offset: 0,
    });

    const harness = createTestHarness({
      manifest,
      config: {
        crawlObserverApiKeySecretRef: "secret-co",
        maxPageLimit: 100,
      },
    });
    await plugin.definition.setup(harness.ctx);

    callCrawlObserverApiMock.mockResolvedValueOnce({
      content: "{\"items\":[]}",
      data: { items: [] },
    });

    await harness.executeTool(TOOL_NAMES.listPages, {
      sessionId: "session-1",
      page_type: "html",
      sort: "page_type",
      order: "asc",
      limit: 250,
      offset: 0,
    });

    expect(callCrawlObserverApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          method: "GET",
          path: "/api/sessions/session-1/pages",
          query: {
            page_type: "html",
            sort: "page_type",
            order: "asc",
            limit: 100,
            offset: 0,
          },
        },
      }),
    );
  });

  it("allows only allowlisted read endpoints", () => {
    expect(
      prepareReadEndpointRequest({
        params: {
          endpoint: "/api/sessions/{id}/pages",
          sessionId: "session-1",
          query: { limit: 250, status_code: ">=400" },
        },
        config: { maxPageLimit: 100 },
      }),
    ).toEqual({
      method: "GET",
      path: "/api/sessions/session-1/pages",
      query: { limit: 100, status_code: ">=400" },
    });

    expect(
      prepareReadEndpointRequest({
        params: {
          endpoint: "/api/sessions/{id}/quality",
          sessionId: "session-1",
        },
        config: {},
      }),
    ).toEqual({
      method: "GET",
      path: "/api/sessions/session-1/quality",
      query: {},
    });

    expect(
      prepareReadEndpointRequest({
        params: {
          endpoint: "/api/sessions/{id}/page-issues",
          sessionId: "session-1",
          query: {
            severity: "warning",
            issue_type: "generic_static_metadata",
            url: "/blog/",
            limit: 250,
          },
        },
        config: { maxPageLimit: 100 },
      }),
    ).toEqual({
      method: "GET",
      path: "/api/sessions/session-1/page-issues",
      query: {
        severity: "warning",
        issue_type: "generic_static_metadata",
        url: "/blog/",
        limit: 100,
      },
    });

    expect(() =>
      prepareReadEndpointRequest({
        params: {
          endpoint: "/api/api-keys",
        },
        config: {},
      }),
    ).toThrow(/not allowed/);
  });

  it("does not expose plaintext API keys through helper errors", async () => {
    const actual =
      await vi.importActual<typeof import("../src/crawlobserver-client.js")>(
        "../src/crawlobserver-client.js",
      );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: "Forbidden" }),
    });

    await expect(
      actual.callCrawlObserverApi({
        config: {
          crawlObserverApiKeySecretRef: "secret-co",
        },
        resolveSecret: async () => "super-secret-api-key",
        fetchFn: fetchMock as unknown as typeof fetch,
        request: {
          method: "GET",
          path: "/api/health",
        },
      }),
    ).rejects.toThrow("CrawlObserver HTTP 403: Forbidden");
    await expect(
      actual.callCrawlObserverApi({
        config: {
          crawlObserverApiKeySecretRef: "secret-co",
        },
        resolveSecret: async () => "super-secret-api-key",
        fetchFn: fetchMock as unknown as typeof fetch,
        request: {
          method: "GET",
          path: "/api/health",
        },
      }),
    ).rejects.not.toThrow("super-secret-api-key");
  });

  it("retries one transient read-only gateway failure", async () => {
    const actual =
      await vi.importActual<typeof import("../src/crawlobserver-client.js")>(
        "../src/crawlobserver-client.js",
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ error: "temporary gateway failure" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ sessions: [], total: 0 }),
      });

    const result = await actual.callCrawlObserverApi({
      config: { crawlObserverApiKeySecretRef: "secret-co" },
      resolveSecret: async () => "super-secret-api-key",
      fetchFn: fetchMock as unknown as typeof fetch,
      request: { method: "GET", path: "/api/sessions" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ sessions: [], total: 0 });
  });

  it("does not retry mutating calls", async () => {
    const actual =
      await vi.importActual<typeof import("../src/crawlobserver-client.js")>(
        "../src/crawlobserver-client.js",
      );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: "temporary gateway failure" }),
    });

    await expect(
      actual.callCrawlObserverApi({
        config: { crawlObserverApiKeySecretRef: "secret-co" },
        resolveSecret: async () => "super-secret-api-key",
        fetchFn: fetchMock as unknown as typeof fetch,
        request: { method: "POST", path: "/api/crawl", body: { seeds: [] } },
      }),
    ).rejects.toThrow("CrawlObserver HTTP 502");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
