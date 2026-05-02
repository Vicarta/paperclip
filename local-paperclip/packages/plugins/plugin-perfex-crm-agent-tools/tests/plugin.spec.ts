import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  buildImplementationTaskPayload,
  classifyPerfexFollowup,
  callPerfexMcpTool,
  listPerfexMcpTools,
  perfexHealthcheck,
} from "../src/perfex-mcp-client.js";

vi.mock("../src/perfex-mcp-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/perfex-mcp-client.js")>(
      "../src/perfex-mcp-client.js",
    );
  return {
    ...actual,
    callPerfexMcpTool: vi.fn(),
    listPerfexMcpTools: vi.fn(),
    perfexHealthcheck: vi.fn(),
  };
});

const callPerfexMcpToolMock = vi.mocked(callPerfexMcpTool);
const listPerfexMcpToolsMock = vi.mocked(listPerfexMcpTools);
const perfexHealthcheckMock = vi.mocked(perfexHealthcheck);

const toolRunCtx = {
  companyId: "969d66ff-d77e-4dbf-8759-1a17c2bb17c2",
  projectId: "22222222-2222-4222-8222-222222222222",
  agentId: "33333333-3333-4333-8333-333333333333",
  runId: "44444444-4444-4444-8444-444444444444",
};

const config = {
  perfexMcpUrl: "https://pxmc.aibizmate.com/mcp",
  perfexHealthUrl: "https://pxmc.aibizmate.com/healthz",
  perfexMcpTokenSecretRef: "secret-perfex",
  perfexProjectId: "101",
  projectManagerId: "7",
  assigneeByActionTypeJson: JSON.stringify({
    seo_refresh: ["11"],
    cro_experiment: ["12", "13"],
  }),
  enableTaskWrites: false,
  defaultDryRun: true,
};

const taskInput = {
  action_type: "seo_refresh",
  title: "Refresh VMFS Recovery page title and CTA",
  affected_urls: ["https://www.diskinternals.com/vmfs-recovery/"],
  requested_changes: "Update page title and CTA copy according to the approved brief.",
  source_evidence: "BigQuery opportunity score 87, GSC position 8.",
  qa_checklist: ["No fake recovery guarantees", "Correct VMFS product route"],
  acceptance_criteria: ["Updated copy is visible on the affected URL"],
  paperclip_issue_key: "DIS-101",
  source_opportunity_id: "opp-1",
  product_lane: "VMFS Recovery",
  due_date: "2026-05-15",
  indexing_recommendation: "submit",
  followup_windows: ["7 days", "14 days", "28 days"],
};

describe("plugin-perfex-crm-agent-tools", () => {
  beforeEach(() => {
    callPerfexMcpToolMock.mockReset();
    listPerfexMcpToolsMock.mockReset();
    perfexHealthcheckMock.mockReset();
  });

  it("builds a human implementation payload with project, manager, and assignees", () => {
    const payload = buildImplementationTaskPayload({ args: taskInput, config });
    expect(payload.project_id).toBe("101");
    expect(payload.project_manager_id).toBe("7");
    expect(payload.assignee_ids).toEqual(["11"]);
    expect(payload.action_type).toBe("seo_refresh");
    expect(payload.description).toContain("Requested Changes");
    expect(payload.metadata.paperclip_company_id).toBe("969d66ff-d77e-4dbf-8759-1a17c2bb17c2");
  });

  it("normalizes legacy short action type aliases to canonical Growth OS routing types", () => {
    const payload = buildImplementationTaskPayload({
      args: { ...taskInput, action_type: "localization" },
      config: {
        ...config,
        assigneeByActionTypeJson: JSON.stringify({
          localization_experiment: ["55"],
        }),
      },
    });
    expect(payload.action_type).toBe("localization_experiment");
    expect(payload.assignee_ids).toEqual(["55"]);
  });

  it("registers read-only health and list tools", async () => {
    const harness = createTestHarness({ manifest, config });
    await plugin.definition.setup(harness.ctx);

    perfexHealthcheckMock.mockResolvedValueOnce({
      content: "{\"ok\":true}",
      data: { ok: true, status: 200 },
    });
    await harness.executeTool(TOOL_NAMES.healthcheck, {}, toolRunCtx);
    expect(perfexHealthcheckMock).toHaveBeenCalledWith(expect.objectContaining({ config }));

    listPerfexMcpToolsMock.mockResolvedValueOnce({
      content: "[]",
      data: { tools: [] },
    });
    await harness.executeTool(TOOL_NAMES.listTools, {}, toolRunCtx);
    expect(listPerfexMcpToolsMock).toHaveBeenCalledWith(expect.objectContaining({ config }));
  });

  it("does not write create-task calls when writes are disabled", async () => {
    const harness = createTestHarness({ manifest, config });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool(
      TOOL_NAMES.createImplementationTask,
      { ...taskInput, dry_run: false },
      toolRunCtx,
    );
    expect(result.data).toMatchObject({
      wrote_to_perfex: false,
      status: "writes_disabled",
    });
    expect(callPerfexMcpToolMock).not.toHaveBeenCalled();
  });

  it("does not write create-task calls by default dry-run even when writes are enabled", async () => {
    const harness = createTestHarness({
      manifest,
      config: { ...config, enableTaskWrites: true, defaultDryRun: true },
    });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool(
      TOOL_NAMES.createImplementationTask,
      taskInput,
      toolRunCtx,
    );
    expect(result.data).toMatchObject({
      wrote_to_perfex: false,
      status: "dry_run",
    });
    expect(callPerfexMcpToolMock).not.toHaveBeenCalled();
  });

  it("calls the configured create tool only when writes are enabled and dry_run is false", async () => {
    const harness = createTestHarness({
      manifest,
      config: { ...config, enableTaskWrites: true, defaultDryRun: true },
    });
    await plugin.definition.setup(harness.ctx);

    callPerfexMcpToolMock.mockResolvedValueOnce({
      content: "{\"task_id\":\"500\"}",
      data: { structuredContent: { task_id: "500" }, content: [] },
      isError: false,
    });
    const result = await harness.executeTool(
      TOOL_NAMES.createImplementationTask,
      { ...taskInput, dry_run: false },
      toolRunCtx,
    );
    expect(callPerfexMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "create_task" }),
    );
    expect(result.data).toMatchObject({
      wrote_to_perfex: true,
      task_id: "500",
    });
  });

  it("syncs task status with comments as read-only MCP calls", async () => {
    const harness = createTestHarness({ manifest, config });
    await plugin.definition.setup(harness.ctx);

    callPerfexMcpToolMock
      .mockResolvedValueOnce({
        content: "{\"status\":\"In Progress\"}",
        data: { structuredContent: { status: "In Progress" }, content: [] },
        isError: false,
      })
      .mockResolvedValueOnce({
        content: "[]",
        data: { structuredContent: { result: [] }, content: [] },
        isError: false,
      });
    const result = await harness.executeTool(
      TOOL_NAMES.syncTaskStatus,
      { task_id: "500" },
      toolRunCtx,
    );
    expect(callPerfexMcpToolMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ toolName: "get_task" }),
    );
    expect(callPerfexMcpToolMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ toolName: "get_task_comments" }),
    );
    expect(result.data).toMatchObject({ taskId: "500" });
  });

  it("classifies verified Perfex comments as eligible for indexing and follow-up", () => {
    const decision = classifyPerfexFollowup({
      taskId: "500",
      statusResult: { structuredContent: { status: "Done" }, content: [] },
      commentsResult: {
        structuredContent: {
          comments: [
            {
              body: "Paperclip result:\nstatus: verified\nchanged_urls:\n- https://www.diskinternals.com/vmfs-recovery/\nsummary:\nUpdated copy.",
            },
          ],
        },
      },
    });
    expect(decision).toMatchObject({
      workflow_state: "verified",
      indexing_eligible: true,
      followup_eligible: true,
      changed_urls: ["https://www.diskinternals.com/vmfs-recovery/"],
    });
  });

  it("does not treat implemented comments as indexing-ready before verification", () => {
    const decision = classifyPerfexFollowup({
      taskId: "501",
      statusResult: { structuredContent: { status: "Done" }, content: [] },
      commentsResult: {
        structuredContent: {
          comments: [
            {
              body: "Paperclip result:\nstatus: implemented\nchanged_urls:\n- https://www.diskinternals.com/linux-reader/",
            },
          ],
        },
      },
    });
    expect(decision).toMatchObject({
      workflow_state: "implemented_pending_verification",
      indexing_eligible: false,
      followup_eligible: false,
    });
  });

  it("parks rejected, needs-clarification, and unknown status paths", () => {
    const rejected = classifyPerfexFollowup({
      taskId: "502",
      statusResult: { structuredContent: { status: "Done" }, content: [] },
      commentsResult: { structuredContent: { comments: [{ body: "Paperclip result:\nstatus: rejected" }] } },
    });
    expect(rejected).toMatchObject({
      workflow_state: "rejected",
      indexing_eligible: false,
      followup_eligible: false,
    });

    const needsClarification = classifyPerfexFollowup({
      taskId: "503",
      statusResult: { structuredContent: { status: "In Progress" }, content: [] },
      commentsResult: { structuredContent: { comments: [{ body: "Paperclip result:\nstatus: needs_clarification" }] } },
    });
    expect(needsClarification).toMatchObject({
      workflow_state: "needs_clarification",
      indexing_eligible: false,
      followup_eligible: false,
    });

    const unknown = classifyPerfexFollowup({
      taskId: "504",
      statusResult: { structuredContent: {}, content: [] },
      commentsResult: { structuredContent: { comments: [] } },
    });
    expect(unknown).toMatchObject({
      workflow_state: "unknown_status",
      indexing_eligible: false,
      followup_eligible: false,
    });
  });
});
