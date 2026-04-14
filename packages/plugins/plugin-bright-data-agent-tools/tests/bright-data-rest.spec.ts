import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadBrightDataSnapshot,
  getBrightDataSnapshotProgress,
  runBrightDataDatasetRequest,
  triggerBrightDataDatasetRequest,
  type BrightDataPluginConfig,
} from "../src/bright-data-mcp-client.js";

const config: BrightDataPluginConfig = {
  brightDataTokenSecretRef: "secret-1",
};

const resolveSecret = vi.fn(async () => "token-123");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("bright-data async dataset client", () => {
  beforeEach(() => {
    resolveSecret.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("triggers a dataset request against /datasets/v3/trigger", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ snapshot_id: "s_123" }));

    const result = await triggerBrightDataDatasetRequest({
      params: {
        datasetId: "gd_posts",
        input: [{ url: "https://www.instagram.com/astrogen.com.ua/" }],
      },
      config,
      resolveSecret,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/datasets/v3/trigger");
    expect(String(url)).toContain("dataset_id=gd_posts");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer token-123",
      "Content-Type": "application/json",
    });
    expect(init.body).toBe(JSON.stringify([{ url: "https://www.instagram.com/astrogen.com.ua/" }]));
    expect(result.data.snapshotId).toBe("s_123");
  });

  it("polls snapshot progress", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "running" }));

    const result = await getBrightDataSnapshotProgress({
      snapshotId: "s_123",
      config,
      resolveSecret,
    });

    expect(String((fetchMock.mock.calls[0] as [URL | string])[0])).toContain("/datasets/v3/progress/s_123");
    expect(result.data.status).toBe("running");
  });

  it("downloads snapshot JSON and reports item count", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1 }, { id: 2 }]));

    const result = await downloadBrightDataSnapshot({
      snapshotId: "s_123",
      format: "json",
      config,
      resolveSecret,
    });

    expect(String((fetchMock.mock.calls[0] as [URL | string])[0])).toContain("/datasets/v3/snapshot/s_123");
    expect(String((fetchMock.mock.calls[0] as [URL | string])[0])).not.toContain("include_errors");
    expect(result.data.itemCount).toBe(2);
    expect(result.data.snapshot).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("supports the validated instagram account recipe via user_name discovery", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ snapshot_id: "s_456" }))
      .mockResolvedValueOnce(jsonResponse({ status: "ready" }))
      .mockResolvedValueOnce(jsonResponse([{ username: "astrogen.com.ua", posts_count: 49 }]));

    const result = await runBrightDataDatasetRequest({
      params: {
        datasetId: "gd_l1vikfch901nx3by4",
        input: [{ user_name: "astrogen.com.ua" }],
        type: "discover_new",
        discoverBy: "user_name",
        pollIntervalMs: 1,
        maxWaitMs: 5000,
      },
      config,
      resolveSecret,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String((fetchMock.mock.calls[0] as [URL | string])[0])).toContain("dataset_id=gd_l1vikfch901nx3by4");
    expect(String((fetchMock.mock.calls[0] as [URL | string])[0])).toContain("discover_by=user_name");
    expect((fetchMock.mock.calls[0] as [URL | string, RequestInit])[1].body).toBe(
      JSON.stringify([{ user_name: "astrogen.com.ua" }]),
    );
    expect(result.data.status).toBe("ready");
    expect(result.data.snapshot).toEqual([{ username: "astrogen.com.ua", posts_count: 49 }]);
  });

  it("runs trigger -> progress -> download when snapshot becomes ready", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ snapshot_id: "s_123" }))
      .mockResolvedValueOnce(jsonResponse({ status: "running" }))
      .mockResolvedValueOnce(jsonResponse({ status: "ready" }))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]));

    const result = await runBrightDataDatasetRequest({
      params: {
        datasetId: "gd_posts",
        input: [{ url: "https://www.instagram.com/astrogen.com.ua/" }],
        pollIntervalMs: 1,
        maxWaitMs: 5000,
      },
      config,
      resolveSecret,
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.data.status).toBe("ready");
    expect(result.data.itemCount).toBe(1);
    expect(result.data.snapshot).toEqual([{ id: 1 }]);
  });
});
