import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pluginRoutes } from "../routes/plugins.js";
import { errorHandler } from "../middleware/index.js";

type IssueRow = { id: string; projectId: string | null };

function createDbStub(issueRows: IssueRow[] = []) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(issueRows),
      })),
    })),
  } as any;
}

function createToolDispatcherStub() {
  return {
    listToolsForAgent: vi.fn(() => [
      {
        name: "paperclip.dataforseo:search-volume",
        displayName: "Search Volume",
        description: "Fetch search volume",
        parametersSchema: { type: "object" },
        pluginId: "plugin-1",
      },
    ]),
    getTool: vi.fn(() => ({ name: "paperclip.dataforseo:search-volume" })),
    executeTool: vi.fn(async (_tool: string, _parameters: unknown, runContext: unknown) => ({
      ok: true,
      runContext,
    })),
  };
}

function createApp({
  actor,
  issueRows,
  dispatcher,
}: {
  actor: Record<string, unknown>;
  issueRows?: IssueRow[];
  dispatcher?: ReturnType<typeof createToolDispatcherStub>;
}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use(
    "/api",
    pluginRoutes(
      createDbStub(issueRows),
      {} as any,
      undefined,
      undefined,
      { toolDispatcher: dispatcher ?? createToolDispatcherStub() },
    ),
  );
  app.use(errorHandler);
  return app;
}

describe("plugin tool routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows agent-authenticated tool discovery via /api/agents/me/plugin-tools", async () => {
    const dispatcher = createToolDispatcherStub();
    const app = createApp({
      actor: {
        type: "agent",
        agentId: "agent-1",
        companyId: "company-1",
        runId: "run-1",
      },
      dispatcher,
    });

    const res = await request(app).get("/api/agents/me/plugin-tools");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(dispatcher.listToolsForAgent).toHaveBeenCalledWith(undefined);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("paperclip.dataforseo:search-volume");
  });

  it("derives agent run context from the checked-out issue when executing a tool", async () => {
    const dispatcher = createToolDispatcherStub();
    const app = createApp({
      actor: {
        type: "agent",
        agentId: "agent-1",
        companyId: "company-1",
        runId: "run-1",
      },
      issueRows: [{ id: "issue-1", projectId: "project-1" }],
      dispatcher,
    });

    const res = await request(app)
      .post("/api/agents/me/plugin-tools/execute")
      .send({
        tool: "paperclip.dataforseo:search-volume",
        parameters: { keyword: "натальна карта фінанси" },
      });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(dispatcher.executeTool).toHaveBeenCalledWith(
      "paperclip.dataforseo:search-volume",
      { keyword: "натальна карта фінанси" },
      {
        agentId: "agent-1",
        runId: "run-1",
        companyId: "company-1",
        projectId: "project-1",
      },
    );
  });

  it("accepts MCP-style name and arguments aliases for agent tool execution", async () => {
    const dispatcher = createToolDispatcherStub();
    const app = createApp({
      actor: {
        type: "agent",
        agentId: "agent-1",
        companyId: "company-1",
        runId: "run-1",
      },
      issueRows: [{ id: "issue-1", projectId: "project-1" }],
      dispatcher,
    });

    const res = await request(app)
      .post("/api/agents/me/plugin-tools/execute")
      .send({
        name: "paperclip.dataforseo:search-volume",
        arguments: { keyword: "соляр" },
      });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(dispatcher.executeTool).toHaveBeenCalledWith(
      "paperclip.dataforseo:search-volume",
      { keyword: "соляр" },
      {
        agentId: "agent-1",
        runId: "run-1",
        companyId: "company-1",
        projectId: "project-1",
      },
    );
  });

  it("keeps board execution on the explicit runContext contract", async () => {
    const dispatcher = createToolDispatcherStub();
    const app = createApp({
      actor: {
        type: "board",
        userId: "user-1",
        companyIds: ["company-1"],
        source: "local_implicit",
        isInstanceAdmin: false,
      },
      dispatcher,
    });

    const res = await request(app)
      .post("/api/plugins/tools/execute")
      .send({
        tool: "paperclip.dataforseo:search-volume",
        parameters: { keyword: "натальна карта фінанси" },
      });

    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body).toEqual({
      error: "\"runContext\" is required and must be an object",
    });
    expect(dispatcher.executeTool).not.toHaveBeenCalled();
  });

  it("returns 403 for agent execution when no projectId can be derived", async () => {
    const dispatcher = createToolDispatcherStub();
    const app = createApp({
      actor: {
        type: "agent",
        agentId: "agent-1",
        companyId: "company-1",
        runId: "run-1",
      },
      issueRows: [{ id: "issue-1", projectId: null }],
      dispatcher,
    });

    const res = await request(app)
      .post("/api/agents/me/plugin-tools/execute")
      .send({
        tool: "paperclip.dataforseo:search-volume",
        parameters: { keyword: "натальна карта фінанси" },
      });

    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body).toEqual({
      error: "Agent tool execution requires a projectId from the current issue context or request body",
    });
    expect(dispatcher.executeTool).not.toHaveBeenCalled();
  });
});
