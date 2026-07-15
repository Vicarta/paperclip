import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { MCP_TOOL_NAMES, TOOL_NAMES } from "../src/constants.js";
import { TOOL_PARAMETER_SCHEMAS } from "../src/tool-schemas.js";
import {
  assertWinningStructureMcpToolContract,
  callWinningStructureMcpTool,
  classifyWinningStructureResult,
  extractWinningStructureProviderCost,
  normalizeWinningStructureToolResult,
  prepareWinningStructureMcpArguments,
  verifyWinningStructureMcpContract,
} from "../src/winning-structure-mcp-client.js";

vi.mock("../src/winning-structure-mcp-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/winning-structure-mcp-client.js")>(
      "../src/winning-structure-mcp-client.js",
    );
  return {
    ...actual,
    callWinningStructureMcpTool: vi.fn(),
    verifyWinningStructureMcpContract: vi.fn(),
  };
});

const callWinningStructureMcpToolMock = vi.mocked(callWinningStructureMcpTool);
const verifyWinningStructureMcpContractMock = vi.mocked(
  verifyWinningStructureMcpContract,
);

const namespace = {
  company_id: "opaque-company",
  project_id: "opaque-project",
  client_key: "diskinternals-us",
};

const taskPayload = {
  ...namespace,
  idempotency_key: "winning-structure:task-1:v1",
  task: {
    page_mode: "existing",
    target_url: "https://www.diskinternals.com/vmfs-recovery/convert-vhd-to-vmdk/",
    primary_keyword: "convert vhd to vmdk",
    auxiliary_keywords: ["vhd to vmdk"],
    intent_hypothesis: "Readers need a safe conversion path.",
    content_goal: "Improve the existing conversion guide.",
  },
  market: {
    geo: "US",
    search_language: "en",
    output_language: "en-US",
    primary_device: "desktop",
  },
};

const runLookup = {
  ...namespace,
  run_id: "wsrun_1",
};

const decisionPayload = {
  ...runLookup,
  decisions: [
    {
      decision_id: "decision_1",
      decision_version: 2,
      selected_option: "use_existing_owner",
      response: {
        selected_owner_url: "https://www.diskinternals.com/existing-owner/",
        rationale: "The existing URL has verified ownership evidence.",
      },
    },
  ],
};

const toolRunCtx = {
  companyId: "11111111-1111-1111-1111-111111111111",
  projectId: "22222222-2222-2222-2222-222222222222",
  agentId: "33333333-3333-3333-3333-333333333333",
  runId: "44444444-4444-4444-4444-444444444444",
  issueId: "55555555-5555-5555-5555-555555555555",
};

function normalizedResult(
  payload: Record<string, unknown>,
  providerCost: { amountUsd: number; currency: string; runId: string | null } | null = null,
) {
  return {
    content: JSON.stringify(payload),
    data: {
      structuredContent: payload,
      content: [],
      classification: classifyWinningStructureResult(payload),
    },
    isError: false,
    providerCost,
  };
}

describe("plugin-winning-structure-mcp-agent-tools", () => {
  beforeEach(() => {
    callWinningStructureMcpToolMock.mockReset();
    verifyWinningStructureMcpContractMock.mockReset();
    verifyWinningStructureMcpContractMock.mockResolvedValue([...MCP_TOOL_NAMES]);
  });

  it("publishes the v0.2.0 five-operation manifest and required capabilities", () => {
    expect(manifest.version).toBe("0.2.0");
    expect(manifest.tools?.map((tool) => tool.name)).toEqual(Object.values(TOOL_NAMES));
    expect(manifest.capabilities).toEqual(
      expect.arrayContaining(["costs.write", "plugin.state.read", "plugin.state.write"]),
    );
  });

  it("uses operation-specific schemas with forward-compatible nested objects", () => {
    expect(TOOL_PARAMETER_SCHEMAS.validateTaskInput.required).toEqual(
      expect.arrayContaining([
        "company_id",
        "project_id",
        "client_key",
        "idempotency_key",
        "task",
        "market",
      ]),
    );
    expect(TOOL_PARAMETER_SCHEMAS.validateTaskInput.properties.task.additionalProperties)
      .toBe(true);
    expect(TOOL_PARAMETER_SCHEMAS.validateTaskInput.properties.business_context)
      .toMatchObject({ type: "object", additionalProperties: true });
    expect(TOOL_PARAMETER_SCHEMAS.getRunStatus.required).toContain("run_id");
    expect(TOOL_PARAMETER_SCHEMAS.submitRunDecisions.properties.decisions)
      .toMatchObject({ minItems: 1, maxItems: 1 });
  });

  it("verifies the remote five-tool contract during setup and reports healthy", async () => {
    const config = {
      winningStructureMcpUrl: "https://winning.example.test/mcp",
      winningStructureMcpTokenSecretRef: "secret-winning",
    };
    const harness = createTestHarness({ manifest, config });
    await plugin.definition.setup(harness.ctx);

    expect(verifyWinningStructureMcpContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ config }),
    );
    expect(await plugin.definition.onHealth?.()).toMatchObject({
      status: "ok",
      details: { contractVerified: true, verifiedTools: [...MCP_TOOL_NAMES] },
    });
  });

  it("reports an error health state when the remote server is missing a required tool", async () => {
    verifyWinningStructureMcpContractMock.mockRejectedValueOnce(
      new Error("Winning Structure MCP is missing required tools: submit_run_decisions"),
    );
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    const health = await plugin.definition.onHealth?.();
    expect(health).toMatchObject({
      status: "error",
      details: { contractVerified: false },
    });
    expect(JSON.stringify(health)).not.toContain("Bearer");
  });

  it("rejects an incomplete tools/list contract and accepts extra remote tools", () => {
    expect(() =>
      assertWinningStructureMcpToolContract(
        MCP_TOOL_NAMES.filter((name) => name !== "submit_run_decisions")
          .map((name) => ({ name })),
      ),
    ).toThrow(/submit_run_decisions/);

    expect(
      assertWinningStructureMcpToolContract([
        ...MCP_TOOL_NAMES.map((name) => ({ name })),
        { name: "future_optional_tool" },
      ]),
    ).toEqual([...MCP_TOOL_NAMES]);
  });

  it("registers and dispatches all five lifecycle wrappers", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    callWinningStructureMcpToolMock
      .mockResolvedValueOnce(normalizedResult({ valid: true }))
      .mockResolvedValueOnce(normalizedResult({ run_id: "wsrun_1", status: "queued" }))
      .mockResolvedValueOnce(normalizedResult({ run_id: "wsrun_1", status: "awaiting_ownership_decision" }))
      .mockResolvedValueOnce(normalizedResult({ run_id: "wsrun_1", status: "fetching_serp", accepted: true }))
      .mockResolvedValueOnce(normalizedResult({ run_id: "wsrun_1", status: "completed" }));

    await harness.executeTool(TOOL_NAMES.validateTaskInput, taskPayload, toolRunCtx);
    await harness.executeTool(TOOL_NAMES.startRun, taskPayload, toolRunCtx);
    await harness.executeTool(TOOL_NAMES.getRunStatus, runLookup, toolRunCtx);
    await harness.executeTool(TOOL_NAMES.submitRunDecisions, decisionPayload, toolRunCtx);
    await harness.executeTool(TOOL_NAMES.getRunResult, runLookup, toolRunCtx);

    expect(callWinningStructureMcpToolMock.mock.calls.map((call) => call[0].toolName))
      .toEqual([...MCP_TOOL_NAMES]);
  });

  it("wraps direct payloads once and preserves already wrapped future fields", () => {
    expect(
      prepareWinningStructureMcpArguments({
        toolName: "validate_task_input",
        args: {
          ...taskPayload,
          task: { ...taskPayload.task, future_task_field: { mode: "new" } },
        },
      }),
    ).toEqual({
      payload: {
        ...taskPayload,
        task: { ...taskPayload.task, future_task_field: { mode: "new" } },
      },
    });

    expect(
      prepareWinningStructureMcpArguments({
        toolName: "get_run_status",
        args: { payload: { ...runLookup, future_lookup_field: true } },
      }),
    ).toEqual({ payload: { ...runLookup, future_lookup_field: true } });
  });

  it("rejects missing namespace and run lookup fields before the remote call", () => {
    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "start_winning_structure_run",
        args: { ...taskPayload, company_id: " " },
      }),
    ).toThrow(/company_id is required/);

    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "get_run_result",
        args: namespace,
      }),
    ).toThrow(/run_id is required/);
  });

  it("rejects known internal aliases before a task reaches the remote MCP", () => {
    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "validate_task_input",
        args: { ...taskPayload, task_input: taskPayload.task },
      }),
    ).toThrow(/task_input is not allowed/);

    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "start_winning_structure_run",
        args: { ...taskPayload, namespace },
      }),
    ).toThrow(/namespace is not allowed/);

    const { idempotency_key: _ignored, ...withoutIdempotencyKey } = taskPayload;
    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "start_winning_structure_run",
        args: withoutIdempotencyKey,
      }),
    ).toThrow(/idempotency_key is required/);
  });

  it("enforces the client_key allowlist for task, lookup, and decision operations", () => {
    const allowedClientKeys = new Set(["diskinternals-us"]);
    expect(
      prepareWinningStructureMcpArguments({
        toolName: "get_run_status",
        args: runLookup,
        allowedClientKeys,
      }),
    ).toEqual({ payload: runLookup });

    for (const [toolName, args] of [
      ["start_winning_structure_run", { ...taskPayload, client_key: "other-client" }],
      ["get_run_status", { ...runLookup, client_key: "other-client" }],
      ["submit_run_decisions", { ...decisionPayload, client_key: "other-client" }],
    ] as const) {
      expect(() =>
        prepareWinningStructureMcpArguments({ toolName, args, allowedClientKeys }),
      ).toThrow(/client_key is not allowed/);
    }
  });

  it("rejects unknown tools and decision batches that are not exactly one item", () => {
    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "generate_publishable_article",
        args: taskPayload,
      }),
    ).toThrow(/not allowed/);

    expect(() =>
      prepareWinningStructureMcpArguments({
        toolName: "submit_run_decisions",
        args: { ...decisionPayload, decisions: [] },
      }),
    ).toThrow(/exactly one pending decision/);
  });

  it("returns a compact paused-run summary while preserving complete structured content", () => {
    const structuredContent = {
      run_id: "wsrun_1",
      status: "awaiting_ownership_decision",
      stage: "discovering_site_ownership",
      decision_requests: [
        {
          decision_id: "decision_1",
          decision_version: 2,
          decision_type: "ownership_conflict",
          options: ["use_existing_owner", "cancel_run"],
          required_response_fields: ["rationale"],
        },
      ],
      internal_future_metadata: { preserved: true },
    };
    const result = normalizeWinningStructureToolResult({ structuredContent, content: [] });
    const summary = JSON.parse(result.content) as Record<string, unknown>;

    expect(summary.classification).toMatchObject({ state: "paused", retryable: false });
    expect(summary.decision_requests).toEqual(structuredContent.decision_requests);
    expect(summary).not.toHaveProperty("internal_future_metadata");
    expect(result.data.structuredContent).toBe(structuredContent);
    expect(result.providerCost).toBeNull();
  });

  it("classifies stale and conflicting decision responses as non-retryable", () => {
    expect(
      classifyWinningStructureResult({
        run_id: "wsrun_1",
        status: "awaiting_ownership_decision",
        errors: ["stale_decision_version"],
      }),
    ).toMatchObject({ state: "stale_decision", retryable: false });

    expect(
      classifyWinningStructureResult({
        run_id: "wsrun_1",
        status: "completed",
        errors: ["decision_version_already_resolved_with_different_response"],
      }),
    ).toMatchObject({ state: "decision_conflict", retryable: false });
  });

  it("compacts completed results without dropping full recommendation data", () => {
    const structuredContent = {
      run_id: "wsrun_1",
      status: "completed",
      human_review_required: true,
      human_review_reasons: ["ownership_boundary_review"],
      winning_structure: Array.from({ length: 20 }, (_, index) => ({
        section_id: `section-${index}`,
        writer_instruction: "Detailed instruction that remains in structuredContent.",
      })),
      added_value_plans: [{ plan_id: "plan-1" }],
      artifacts: { json: "artifact://result", markdown: "artifact://report" },
    };
    const result = normalizeWinningStructureToolResult({ structuredContent });
    const summary = JSON.parse(result.content) as Record<string, unknown>;

    expect(summary).toMatchObject({
      winning_structure_count: 20,
      added_value_plan_count: 1,
      artifact_keys: ["json", "markdown"],
    });
    expect(result.content).not.toContain("Detailed instruction");
    expect(result.data.structuredContent).toBe(structuredContent);
  });

  it("exposes the complete final result payload for durable import", () => {
    const structuredContent = {
      run_id: "wsrun_1",
      status: "completed",
      winning_structure: [{
        section_id: "section-1",
        writer_instruction: "Preserve this exact structured requirement.",
      }],
      content_quality_requirements: {
        verification_boundary: "requirements_only_not_content_verdict",
      },
      artifacts: {
        winning_structure_json: "artifact://result.json",
        winning_structure_markdown: "artifact://result.md",
      },
    };

    const result = normalizeWinningStructureToolResult(
      { structuredContent },
      { exposeFullPayload: true },
    );
    expect(JSON.parse(result.content)).toEqual(structuredContent);
    expect(result.content).toContain("Preserve this exact structured requirement.");
  });

  it("normalizes JSON text fallback and redacts authorization-shaped plain text", () => {
    const parsed = normalizeWinningStructureToolResult({
      content: [
        { type: "text", text: JSON.stringify({ run_id: "wsrun_1", status: "fetching_serp" }) },
      ],
    });
    expect(JSON.parse(parsed.content)).toMatchObject({
      classification: { state: "active" },
      run_id: "wsrun_1",
    });

    const redacted = normalizeWinningStructureToolResult({
      isError: true,
      content: [{ type: "text", text: "Authorization: Bearer super-secret-token" }],
    });
    expect(redacted.content).toContain("[REDACTED]");
    expect(redacted.content).not.toContain("super-secret-token");
  });

  it("extracts and normalizes completed provider costs from result or status metadata", () => {
    expect(
      extractWinningStructureProviderCost({
        run_id: "wsrun_1",
        status: "completed",
        cost: { total_estimated: "0.001", currency: "usd" },
      }),
    ).toEqual({ amountUsd: 0.001, currency: "USD", runId: "wsrun_1" });

    expect(
      extractWinningStructureProviderCost({
        run_id: "wsrun_2",
        status: "completed",
        status_metadata: { cost: { total: 1.25 } },
      }),
    ).toEqual({ amountUsd: 1.25, currency: "USD", runId: "wsrun_2" });

    expect(
      extractWinningStructureProviderCost({
        run_id: "wsrun_zero",
        status: "completed",
        cost: { total_estimated: 0, currency: "usd" },
      }),
    ).toEqual({ amountUsd: 0, currency: "USD", runId: "wsrun_zero" });

    for (const payload of [
      { status: "fetching_serp", cost: { total_estimated: 1 } },
      { status: "completed", cost: { total_estimated: -1 } },
      { status: "completed", cost: { total_estimated: "not-a-number" } },
    ]) {
      expect(extractWinningStructureProviderCost(payload)).toBeNull();
    }
  });

  it("writes sub-cent provider cost once per completed remote run", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    const completed = normalizedResult(
      { run_id: "wsrun_cost", status: "completed" },
      { amountUsd: 0.001, currency: "USD", runId: "wsrun_cost" },
    );
    callWinningStructureMcpToolMock
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);

    await harness.executeTool(
      TOOL_NAMES.getRunStatus,
      { ...runLookup, run_id: "wsrun_cost" },
      toolRunCtx,
    );
    await harness.executeTool(
      TOOL_NAMES.getRunResult,
      { ...runLookup, run_id: "wsrun_cost" },
      toolRunCtx,
    );

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      companyId: toolRunCtx.companyId,
      projectId: toolRunCtx.projectId,
      agentId: toolRunCtx.agentId,
      heartbeatRunId: toolRunCtx.runId,
      provider: "winning-structure-mcp",
      billingCode: "winning-structure-mcp",
      costCents: 0,
      amountMicros: 1000,
      currency: "USD",
      operation: "get_run_status",
    });
  });

  it("does not record a provider cost event for a paused response", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    callWinningStructureMcpToolMock.mockResolvedValueOnce(
      normalizedResult({ run_id: "wsrun_1", status: "awaiting_added_value_input" }),
    );

    await harness.executeTool(TOOL_NAMES.getRunStatus, runLookup, toolRunCtx);
    expect(harness.costs).toHaveLength(0);
  });

  it("records one zero-cost provider-reported event for an auditable completed run", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    const completed = normalizedResult(
      { run_id: "wsrun_zero_cost", status: "completed" },
      { amountUsd: 0, currency: "USD", runId: "wsrun_zero_cost" },
    );
    callWinningStructureMcpToolMock
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);

    await harness.executeTool(
      TOOL_NAMES.getRunStatus,
      { ...runLookup, run_id: "wsrun_zero_cost" },
      toolRunCtx,
    );
    await harness.executeTool(
      TOOL_NAMES.getRunResult,
      { ...runLookup, run_id: "wsrun_zero_cost" },
      toolRunCtx,
    );

    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]).toMatchObject({
      costCents: 0,
      amountMicros: 0,
      operation: "get_run_status",
      provider: "winning-structure-mcp",
    });
  });

  it("respects disabled cost accounting while preserving the provider result", async () => {
    const harness = createTestHarness({
      manifest,
      config: { costAccountingMode: "disabled" },
    });
    await plugin.definition.setup(harness.ctx);
    callWinningStructureMcpToolMock.mockResolvedValueOnce(normalizedResult(
      { run_id: "wsrun_disabled_cost", status: "completed" },
      { amountUsd: 0.25, currency: "USD", runId: "wsrun_disabled_cost" },
    ));

    const result = await harness.executeTool(
      TOOL_NAMES.getRunResult,
      { ...runLookup, run_id: "wsrun_disabled_cost" },
      toolRunCtx,
    );

    expect(result.data).toBeDefined();
    expect(harness.costs).toHaveLength(0);
  });

  it("does not retry a failed transport call inside the wrapper", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    callWinningStructureMcpToolMock.mockRejectedValueOnce(new Error("transport unavailable"));

    await expect(
      harness.executeTool(TOOL_NAMES.getRunStatus, runLookup, toolRunCtx),
    ).rejects.toThrow(/transport unavailable/);
    expect(callWinningStructureMcpToolMock).toHaveBeenCalledTimes(1);
  });

  it("passes only secret references in worker call metadata", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        winningStructureMcpUrl: "https://winning.example.test/mcp",
        winningStructureMcpTokenSecretRef: "secret-ref-only",
      },
    });
    await plugin.definition.setup(harness.ctx);
    callWinningStructureMcpToolMock.mockResolvedValueOnce(
      normalizedResult({ run_id: "wsrun_1", status: "fetching_serp" }),
    );

    await harness.executeTool(TOOL_NAMES.getRunStatus, runLookup, toolRunCtx);
    const serializedCall = JSON.stringify(callWinningStructureMcpToolMock.mock.calls[0]?.[0]);
    expect(serializedCall).toContain("secret-ref-only");
    expect(serializedCall).not.toContain("Authorization");
    expect(serializedCall).not.toContain("Bearer");
  });
});
