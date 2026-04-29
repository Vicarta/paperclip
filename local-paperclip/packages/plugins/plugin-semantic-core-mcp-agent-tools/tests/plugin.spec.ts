import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  callSemanticCoreMcpTool,
  listSemanticCoreMcpTools,
  prepareSemanticCoreMcpArguments,
  runLayerAndWait,
  runSemanticCoreSmoke,
  validatePaperclipImportPayload,
} from "../src/semantic-core-mcp-client.js";

vi.mock("../src/semantic-core-mcp-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/semantic-core-mcp-client.js")>(
      "../src/semantic-core-mcp-client.js",
    );
  return {
    ...actual,
    callSemanticCoreMcpTool: vi.fn(),
    listSemanticCoreMcpTools: vi.fn(),
    runLayerAndWait: vi.fn(),
    runSemanticCoreSmoke: vi.fn(),
  };
});

const callSemanticCoreMcpToolMock = vi.mocked(callSemanticCoreMcpTool);
const listSemanticCoreMcpToolsMock = vi.mocked(listSemanticCoreMcpTools);
const runLayerAndWaitMock = vi.mocked(runLayerAndWait);
const runSemanticCoreSmokeMock = vi.mocked(runSemanticCoreSmoke);

const toolRunCtx = {
  companyId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  agentId: "33333333-3333-4333-8333-333333333333",
  runId: "44444444-4444-4444-8444-444444444444",
};

describe("plugin-semantic-core-mcp-agent-tools", () => {
  beforeEach(() => {
    callSemanticCoreMcpToolMock.mockReset();
    listSemanticCoreMcpToolsMock.mockReset();
    runLayerAndWaitMock.mockReset();
    runSemanticCoreSmokeMock.mockReset();
  });

  it("registers list tools and exact MCP wrapper tools", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        semanticCoreMcpUrl: "https://semantic.example.test/mcp",
        semanticCoreMcpTokenSecretRef: "secret-semantic",
      },
    });
    await plugin.definition.setup(harness.ctx);

    listSemanticCoreMcpToolsMock.mockResolvedValueOnce({
      content: "[]",
      data: { tools: [] },
    });

    await harness.executeTool(TOOL_NAMES.listTools, {}, toolRunCtx);
    expect(listSemanticCoreMcpToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          semanticCoreMcpUrl: "https://semantic.example.test/mcp",
          semanticCoreMcpTokenSecretRef: "secret-semantic",
        },
      }),
    );

    callSemanticCoreMcpToolMock.mockResolvedValueOnce({
      content: "{}",
      data: { structuredContent: {}, content: [] },
      isError: false,
    });
    await harness.executeTool(TOOL_NAMES.getPaperclipImportSchema, {}, toolRunCtx);
    expect(callSemanticCoreMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "get_paperclip_import_schema" }),
    );
  });

  it("allows only configured semantic layers", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "core_product_intent",
          mode: "mock",
        },
      }),
    ).toEqual({
      payload: {
        project_id: "astrogen-ukraine",
        layer: "core_product_intent",
        mode: "mock",
      },
      async_job: true,
    });

    expect(() =>
      prepareSemanticCoreMcpArguments({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "editorial_growth_intent",
        },
      }),
    ).toThrow(/layer must be one of/);
  });

  it("enforces optional project and client allowlists", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "diskinternals-us",
          project_config: { client_key: "diskinternals-us" },
        },
        allowedProjectIds: new Set(["diskinternals-us"]),
        allowedClientKeys: new Set(["diskinternals-us"]),
      }),
    ).toEqual({
      payload: {
        project_id: "diskinternals-us",
        inputs: {
          project_config: { client_key: "diskinternals-us" },
          seed_catalog: undefined,
          existing_pages: undefined,
          audience_summary: null,
          gsc_refinement_input: null,
        },
      },
    });

    expect(() =>
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "astrogen-ukraine",
          project_config: { client_key: "astrogen-ukraine" },
        },
        allowedProjectIds: new Set(["diskinternals-us"]),
      }),
    ).toThrow(/project_id is not allowed/);
  });

  it("preserves register_project inputs and normalizes seed_catalog for the live MCP payload contract", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "paperclip-smoke",
          inputs: {
            project_config: { site_domain: "example.com" },
            seed_catalog: [],
            existing_pages: [],
          },
        },
      }),
    ).toEqual({
      payload: {
        project_id: "paperclip-smoke",
        inputs: {
          project_config: { site_domain: "example.com" },
          seed_catalog: { seeds: [] },
          existing_pages: [],
        },
      },
    });
  });

  it("nests flat register_project inputs and normalizes array seed catalogs", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "paperclip-smoke",
          project_config: { site_domain: "example.com" },
          seed_catalog: [{ seed: "натальна карта" }],
          existing_pages: [],
        },
      }),
    ).toEqual({
      payload: {
        project_id: "paperclip-smoke",
        inputs: {
          project_config: { site_domain: "example.com" },
          seed_catalog: { seeds: [{ seed: "натальна карта" }] },
          existing_pages: [],
          audience_summary: null,
          gsc_refinement_input: null,
        },
      },
    });
  });

  it("validates paperclip_import.v1 before storing import candidate", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callSemanticCoreMcpToolMock.mockResolvedValueOnce({
      content: JSON.stringify({
        schema_version: "paperclip_import.v1",
        run_id: "run_1",
        artifacts: {
          accepted_keywords: [],
          clusters: [],
          serp_segments: [],
        },
        cost: {
          total_estimated: 1.23,
          events: [],
        },
      }),
      data: {
        structuredContent: {
          schema_version: "paperclip_import.v1",
          run_id: "run_1",
          artifacts: {
            accepted_keywords: [],
            clusters: [],
            serp_segments: [],
          },
          cost: {
            total_estimated: 1.23,
            events: [],
          },
        },
        content: [],
      },
      isError: false,
    });

    const result = await harness.executeTool(
      TOOL_NAMES.preparePaperclipImport,
      { run_id: "run_1" },
      toolRunCtx,
    );

    expect(result.content).toContain("\"status\": \"validated\"");
    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]?.provider).toBe("semantic-core-builder");
  });

  it("rejects malformed import payloads", () => {
    expect(() =>
      validatePaperclipImportPayload({
        schema_version: "paperclip_import.v0",
        artifacts: {},
        cost: {},
      }),
    ).toThrow(/schema_version/);
  });

  it("stores completed run-layer-and-wait results", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    runLayerAndWaitMock.mockResolvedValueOnce({
      content: JSON.stringify({
        status: "completed",
        job_id: "job_1",
        run_id: "run_1",
      }),
      data: {
        status: "completed",
        job_id: "job_1",
        run_id: "run_1",
      },
    });

    const result = await harness.executeTool(
      TOOL_NAMES.runLayerAndWait,
      {
        project_id: "diskinternals-us",
        layer: "core_product_intent",
        mode: "mock",
      },
      toolRunCtx,
    );

    expect(result.content).toContain("job_1");
  });

  it("runs smoke test through dedicated smoke helper", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    runSemanticCoreSmokeMock.mockResolvedValueOnce({
      content: JSON.stringify({
        status: "ok",
        run_id: "run_smoke",
        schema_version: "paperclip_import.v1",
      }),
      data: {
        project_id: "semantic-smoke",
        run: { data: { run_id: "run_smoke" } },
        validation: { schemaVersion: "paperclip_import.v1" },
      },
    });

    const result = await harness.executeTool(
      TOOL_NAMES.smokeTest,
      { project_id: "semantic-smoke" },
      toolRunCtx,
    );

    expect(JSON.parse(result.content ?? "{}")).toMatchObject({ status: "ok" });
  });
});
