import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { agentRoutes } from "../routes/agents.js";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock("../services/index.js", async () => {
  const actual = await vi.importActual<typeof import("../services/index.js")>("../services/index.js");
  return {
    ...actual,
    agentService: () => mockAgentService,
    accessService: () => ({}),
    approvalService: () => ({}),
    heartbeatService: () => ({}),
    issueApprovalService: () => ({}),
    issueService: () => ({}),
    secretService: () => ({}),
    logActivity: vi.fn(),
  };
});

const mockToolDispatcher = {
  listToolsForAgent: vi.fn(),
  executeTool: vi.fn(),
};

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", agentRoutes({} as any, { toolDispatcher: mockToolDispatcher as any }));
  app.use(errorHandler);
  return app;
}

describe("agent plugin tool routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToolDispatcher.listToolsForAgent.mockReturnValue([
      { name: "paperclip.exa-agent-tools:web-search", description: "Search the web", inputSchema: { type: "object" } },
    ]);
    mockToolDispatcher.executeTool.mockResolvedValue({
      pluginId: "paperclip.exa-agent-tools",
      toolName: "web-search",
      result: { content: [{ type: "text", text: "ok" }] },
    });
  });

  it("lists plugin tools for an authenticated agent", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      source: "agent_jwt",
    });

    const res = await request(app).get("/api/agents/me/plugin-tools");

    expect(res.status).toBe(200);
    expect(mockToolDispatcher.listToolsForAgent).toHaveBeenCalledWith(undefined);
    expect(res.body).toHaveLength(1);
  });

  it("executes plugin tools using the authenticated agent run context", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      source: "agent_jwt",
    });

    const res = await request(app)
      .post("/api/agents/me/plugin-tools/execute")
      .send({
        tool: "paperclip.exa-agent-tools:web-search",
        parameters: { query: "astrogen money competitors" },
        projectId: "project-1",
      });

    expect(res.status).toBe(200);
    expect(mockToolDispatcher.executeTool).toHaveBeenCalledWith(
      "paperclip.exa-agent-tools:web-search",
      { query: "astrogen money competitors" },
      {
        agentId: "agent-1",
        runId: "run-1",
        companyId: "company-1",
        projectId: "project-1",
      },
    );
  });

  it("rejects execute requests when the agent run id is missing", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      source: "agent_key",
    });

    const res = await request(app)
      .post("/api/agents/me/plugin-tools/execute")
      .send({
        tool: "paperclip.exa-agent-tools:web-search",
        parameters: { query: "astrogen money competitors" },
        projectId: "project-1",
      });

    expect(res.status).toBe(409);
    expect(mockToolDispatcher.executeTool).not.toHaveBeenCalled();
  });
});
