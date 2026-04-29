import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  callWinningStructureMcpTool,
  normalizeWinningStructureToolResult,
  prepareWinningStructureMcpArguments,
} from "../src/winning-structure-mcp-client.js";

vi.mock("../src/winning-structure-mcp-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/winning-structure-mcp-client.js")>(
      "../src/winning-structure-mcp-client.js",
    );
  return {
    ...actual,
    callWinningStructureMcpTool: vi.fn(),
  };
});

const callWinningStructureMcpToolMock = vi.mocked(callWinningStructureMcpTool);

describe("plugin-winning-structure-mcp-agent-tools", () => {
  beforeEach(() => {
    callWinningStructureMcpToolMock.mockReset();
  });

  it("registers the validate task input wrapper tool", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        winningStructureMcpUrl: "https://winning.example.test/mcp",
        winningStructureMcpTokenSecretRef: "secret-winning",
        allowedClientKeysCsv: "diskinternals-us",
      },
    });
    await plugin.definition.setup(harness.ctx);

    callWinningStructureMcpToolMock.mockResolvedValueOnce({
      content: "valid",
      data: { structuredContent: { valid: true }, content: [] },
      isError: false,
    });

    const params = {
      company_id: "opaque-company",
      project_id: "opaque-project",
      client_key: "diskinternals-us",
      task: {
        page_mode: "existing",
        target_url: "https://www.diskinternals.com/vmfs-recovery/convert-vhd-to-vmdk/",
        primary_keyword: "convert vhd to vmdk",
      },
      market: {
        geo: "US",
        search_language: "en",
        output_language: "en",
        primary_device: "desktop",
      },
    };

    const result = await harness.executeTool(TOOL_NAMES.validateTaskInput, params);

    expect(callWinningStructureMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "validate_task_input",
        args: params,
        config: {
          winningStructureMcpUrl: "https://winning.example.test/mcp",
          winningStructureMcpTokenSecretRef: "secret-winning",
          allowedClientKeysCsv: "diskinternals-us",
        },
      }),
    );
    expect(result.content).toBe("valid");
  });

  it("registers async lifecycle wrapper tools", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callWinningStructureMcpToolMock
      .mockResolvedValueOnce({
        content: "started",
        data: { structuredContent: { run_id: "wsrun_1" }, content: [] },
        isError: false,
      })
      .mockResolvedValueOnce({
        content: "running",
        data: { structuredContent: { status: "fetching_serp" }, content: [] },
        isError: false,
      })
      .mockResolvedValueOnce({
        content: "completed",
        data: { structuredContent: { status: "completed" }, content: [] },
        isError: false,
      });

    await harness.executeTool(TOOL_NAMES.startRun, {
      client_key: "diskinternals-us",
      idempotency_key: "stable-key",
    });
    await harness.executeTool(TOOL_NAMES.getRunStatus, { run_id: "wsrun_1" });
    await harness.executeTool(TOOL_NAMES.getRunResult, { run_id: "wsrun_1" });

    expect(callWinningStructureMcpToolMock.mock.calls.map((call) => call[0].toolName)).toEqual([
      "start_winning_structure_run",
      "get_run_status",
      "get_run_result",
    ]);
  });

  it("rejects non-v1 MCP tool names", () => {
    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "generate_publishable_article",
        args: {},
      }),
    ).toThrow(/not allowed/);
  });

  it("enforces optional client_key allowlist", () => {
    expect(
      prepareWinningStructureMcpArguments({
        toolName: "start_winning_structure_run",
        args: { client_key: "diskinternals-us" },
        allowedClientKeys: new Set(["diskinternals-us"]),
      }),
    ).toEqual({ client_key: "diskinternals-us" });

    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "start_winning_structure_run",
        args: { client_key: "astrogen-ukraine" },
        allowedClientKeys: new Set(["diskinternals-us"]),
      }),
    ).toThrow(/client_key is not allowed/);
  });

  it("normalizes structured MCP results for agent-readable output", () => {
    expect(
      normalizeWinningStructureToolResult({
        structuredContent: {
          run_id: "wsrun_1",
          cache_summary: {
            serp_cache_hit: true,
          },
        },
        content: [],
      }),
    ).toEqual({
      isError: false,
      content: JSON.stringify(
        {
          run_id: "wsrun_1",
          cache_summary: {
            serp_cache_hit: true,
          },
        },
        null,
        2,
      ),
      data: {
        structuredContent: {
          run_id: "wsrun_1",
          cache_summary: {
            serp_cache_hit: true,
          },
        },
        content: [],
      },
    });
  });
});
