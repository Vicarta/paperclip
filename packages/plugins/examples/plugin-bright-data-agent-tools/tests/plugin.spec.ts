import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  callBrightDataTool,
  downloadBrightDataSnapshot,
  getBrightDataSnapshotProgress,
  listBrightDataTools,
  resolveInstagramAccountPostSet,
  runBrightDataDatasetRequest,
  triggerBrightDataDatasetRequest,
} from "../src/bright-data-mcp-client.js";

vi.mock("../src/bright-data-mcp-client.js", async () => {
  const actual = await vi.importActual<typeof import("../src/bright-data-mcp-client.js")>("../src/bright-data-mcp-client.js");
  return {
    ...actual,
    listBrightDataTools: vi.fn(),
    callBrightDataTool: vi.fn(),
    triggerBrightDataDatasetRequest: vi.fn(),
    getBrightDataSnapshotProgress: vi.fn(),
    downloadBrightDataSnapshot: vi.fn(),
    runBrightDataDatasetRequest: vi.fn(),
    resolveInstagramAccountPostSet: vi.fn(),
  };
});

const listBrightDataToolsMock = vi.mocked(listBrightDataTools);
const callBrightDataToolMock = vi.mocked(callBrightDataTool);
const triggerBrightDataDatasetRequestMock = vi.mocked(triggerBrightDataDatasetRequest);
const getBrightDataSnapshotProgressMock = vi.mocked(getBrightDataSnapshotProgress);
const downloadBrightDataSnapshotMock = vi.mocked(downloadBrightDataSnapshot);
const runBrightDataDatasetRequestMock = vi.mocked(runBrightDataDatasetRequest);
const resolveInstagramAccountPostSetMock = vi.mocked(resolveInstagramAccountPostSet);

describe("plugin-bright-data-agent-tools", () => {
  beforeEach(() => {
    listBrightDataToolsMock.mockReset();
    callBrightDataToolMock.mockReset();
    triggerBrightDataDatasetRequestMock.mockReset();
    getBrightDataSnapshotProgressMock.mockReset();
    downloadBrightDataSnapshotMock.mockReset();
    runBrightDataDatasetRequestMock.mockReset();
    resolveInstagramAccountPostSetMock.mockReset();
  });

  it("registers Bright Data-backed tools and lists remote tools", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        brightDataTokenSecretRef: "secret-1",
      },
    });
    await plugin.definition.setup(harness.ctx);

    listBrightDataToolsMock.mockResolvedValueOnce({
      content: "tool_a: First tool",
      data: {
        tools: [{ name: "tool_a", description: "First tool", inputSchema: null }],
      },
    });

    const result = await harness.executeTool(TOOL_NAMES.listTools, {});

    expect(listBrightDataToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { brightDataTokenSecretRef: "secret-1" },
      }),
    );
    expect(result.content).toBe("tool_a: First tool");
  });

  it("returns tool errors cleanly", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callBrightDataToolMock.mockResolvedValueOnce({
      isError: true,
      content: "Rate limited",
      data: { content: [], structuredContent: null },
    });

    const result = await harness.executeTool(TOOL_NAMES.callTool, {
      remoteToolName: "social_lookup",
      arguments: { url: "https://www.instagram.com/astrogen.com.ua/" },
    });

    expect(result).toEqual({ error: "Rate limited" });
  });

  it("forwards remoteToolName and arguments into the Bright Data client", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        brightDataTokenSecretRef: "secret-1",
      },
    });
    await plugin.definition.setup(harness.ctx);

    callBrightDataToolMock.mockResolvedValueOnce({
      isError: false,
      content: "Fetched profile",
      data: { content: [{ type: "text", text: "Fetched profile" }], structuredContent: null },
    });

    const result = await harness.executeTool(TOOL_NAMES.callTool, {
      remoteToolName: "social_lookup",
      arguments: { handle: "astrogen.com.ua" },
    });

    expect(callBrightDataToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteToolName: "social_lookup",
        args: { handle: "astrogen.com.ua" },
        config: { brightDataTokenSecretRef: "secret-1" },
      }),
    );
    expect(result.content).toBe("Fetched profile");
  });

  it("triggers an async dataset request", async () => {
    const harness = createTestHarness({
      manifest,
      config: { brightDataTokenSecretRef: "secret-1" },
    });
    await plugin.definition.setup(harness.ctx);

    triggerBrightDataDatasetRequestMock.mockResolvedValueOnce({
      content: "Triggered Bright Data dataset request for gd_posts. Snapshot ID: s_123",
      data: { datasetId: "gd_posts", snapshotId: "s_123", response: { snapshot_id: "s_123" } },
    });

    const result = await harness.executeTool(TOOL_NAMES.triggerDatasetRequest, {
      datasetId: "gd_posts",
      input: [{ url: "https://www.instagram.com/astrogen.com.ua/" }],
    });

    expect(triggerBrightDataDatasetRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          datasetId: "gd_posts",
          input: [{ url: "https://www.instagram.com/astrogen.com.ua/" }],
        }),
      }),
    );
    expect(result.content).toContain("Snapshot ID: s_123");
  });

  it("fetches snapshot progress", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    getBrightDataSnapshotProgressMock.mockResolvedValueOnce({
      content: "Snapshot s_123 status: running",
      data: { snapshotId: "s_123", status: "running", response: { status: "running" } },
    });

    const result = await harness.executeTool(TOOL_NAMES.getSnapshotProgress, {
      snapshotId: "s_123",
    });

    expect(getBrightDataSnapshotProgressMock).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: "s_123" }),
    );
    expect(result.content).toContain("running");
  });

  it("downloads a snapshot", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    downloadBrightDataSnapshotMock.mockResolvedValueOnce({
      content: "Downloaded snapshot s_123 (2 items)",
      data: { snapshotId: "s_123", format: "json", itemCount: 2, snapshot: [{ id: 1 }, { id: 2 }] },
    });

    const result = await harness.executeTool(TOOL_NAMES.downloadSnapshot, {
      snapshotId: "s_123",
      format: "json",
    });

    expect(downloadBrightDataSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: "s_123", format: "json" }),
    );
    expect(result.content).toContain("Downloaded snapshot");
  });

  it("runs an async dataset request end to end", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    runBrightDataDatasetRequestMock.mockResolvedValueOnce({
      content: "Bright Data dataset request is ready. Snapshot ID: s_123",
      data: { snapshotId: "s_123", status: "ready", snapshot: [{ id: 1 }] },
    });

    const result = await harness.executeTool(TOOL_NAMES.runDatasetRequest, {
      datasetId: "gd_posts",
      input: [{ url: "https://www.instagram.com/astrogen.com.ua/" }],
      maxWaitMs: 10000,
      pollIntervalMs: 1000,
    });

    expect(runBrightDataDatasetRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          datasetId: "gd_posts",
          maxWaitMs: 10000,
          pollIntervalMs: 1000,
        }),
      }),
    );
    expect(result.content).toContain("ready");
  });

  it("resolves a full Instagram account post set", async () => {
    const harness = createTestHarness({
      manifest,
      config: { brightDataTokenSecretRef: "secret-1" },
    });
    await plugin.definition.setup(harness.ctx);

    resolveInstagramAccountPostSetMock.mockResolvedValueOnce({
      content: "Resolved Instagram account post set for @astrogen.com.ua.",
      data: {
        handle: "astrogen.com.ua",
        profileUrl: "https://www.instagram.com/astrogen.com.ua/",
        canonicalUrlCount: 49,
        finalDetailedCount: 49,
        isComplete: true,
      },
    });

    const result = await harness.executeTool(TOOL_NAMES.resolveInstagramAccountPostSet, {
      handleOrUrl: "https://www.instagram.com/astrogen.com.ua/",
      expectedPostCount: 49,
    });

    expect(resolveInstagramAccountPostSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          handleOrUrl: "https://www.instagram.com/astrogen.com.ua/",
          expectedPostCount: 49,
        }),
        config: { brightDataTokenSecretRef: "secret-1" },
      }),
    );
    expect(result.content).toContain("@astrogen.com.ua");
  });
});
