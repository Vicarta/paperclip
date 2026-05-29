import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  callCrawlObserverApi,
  prepareReadEndpointRequest,
  prepareStartCrawlBody,
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
});
