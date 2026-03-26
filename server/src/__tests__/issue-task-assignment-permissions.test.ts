import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
  findMentionedAgents: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(),
}));

const mockProjectService = vi.hoisted(() => ({}));
const mockGoalService = vi.hoisted(() => ({}));
const mockIssueApprovalService = vi.hoisted(() => ({}));
const mockDocumentService = vi.hoisted(() => ({}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  goalService: () => mockGoalService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  documentService: () => mockDocumentService,
  logActivity: mockLogActivity,
  projectService: () => mockProjectService,
}));

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const ISSUE_ID = "22222222-2222-2222-2222-222222222222";
const ACTOR_AGENT_ID = "33333333-3333-3333-3333-333333333333";
const TARGET_AGENT_ID = "44444444-4444-4444-4444-444444444444";

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: ISSUE_ID,
    companyId: COMPANY_ID,
    projectId: null,
    goalId: null,
    parentId: null,
    title: "Assignment permission test",
    description: null,
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: "user-1",
    issueNumber: 1,
    identifier: "TST-1",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-03-26T00:00:00.000Z"),
    updatedAt: new Date("2026-03-26T00:00:00.000Z"),
    ...overrides,
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "agent",
      agentId: ACTOR_AGENT_ID,
      companyId: COMPANY_ID,
      source: "api_key",
      runId: "run-1",
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("PATCH /issues/:id task assignment permissions", () => {
  beforeEach(() => {
    mockIssueService.getById.mockReset();
    mockIssueService.update.mockReset();
    mockIssueService.addComment.mockReset();
    mockIssueService.findMentionedAgents.mockReset();
    mockAccessService.canUser.mockReset();
    mockAccessService.hasPermission.mockReset();
    mockAgentService.getById.mockReset();
    mockHeartbeatService.wakeup.mockReset();
    mockLogActivity.mockReset();

    mockIssueService.getById.mockResolvedValue(makeIssue());
    mockIssueService.update.mockResolvedValue(makeIssue({ assigneeAgentId: TARGET_AGENT_ID }));
    mockIssueService.findMentionedAgents.mockResolvedValue([]);
    mockAccessService.hasPermission.mockResolvedValue(false);
    mockAgentService.getById.mockResolvedValue({
      id: ACTOR_AGENT_ID,
      companyId: COMPANY_ID,
      role: "cmo",
      permissions: null,
    });
    mockLogActivity.mockResolvedValue(undefined);
    mockHeartbeatService.wakeup.mockResolvedValue({ id: "run-2" });
  });

  it("rejects agent reassignment without canonical grant or legacy fallback", async () => {
    const app = createApp();

    const res = await request(app)
      .patch(`/api/issues/${ISSUE_ID}`)
      .send({ assigneeAgentId: TARGET_AGENT_ID });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Missing permission: tasks:assign" });
    expect(mockAccessService.hasPermission).toHaveBeenCalledWith(
      COMPANY_ID,
      "agent",
      ACTOR_AGENT_ID,
      "tasks:assign",
    );
    expect(mockIssueService.update).not.toHaveBeenCalled();
  });

  it("allows reassignment when the agent has the canonical tasks:assign grant", async () => {
    mockAccessService.hasPermission.mockResolvedValue(true);
    const app = createApp();

    const res = await request(app)
      .patch(`/api/issues/${ISSUE_ID}`)
      .send({ assigneeAgentId: TARGET_AGENT_ID });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith(
      ISSUE_ID,
      expect.objectContaining({ assigneeAgentId: TARGET_AGENT_ID }),
    );
  });

  it("preserves the legacy canCreateAgents fallback until it is explicitly retired", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: ACTOR_AGENT_ID,
      companyId: COMPANY_ID,
      role: "cmo",
      permissions: { canCreateAgents: true },
    });
    const app = createApp();

    const res = await request(app)
      .patch(`/api/issues/${ISSUE_ID}`)
      .send({ assigneeAgentId: TARGET_AGENT_ID });

    expect(res.status).toBe(200);
    expect(mockAccessService.hasPermission).toHaveBeenCalledWith(
      COMPANY_ID,
      "agent",
      ACTOR_AGENT_ID,
      "tasks:assign",
    );
    expect(mockIssueService.update).toHaveBeenCalledWith(
      ISSUE_ID,
      expect.objectContaining({ assigneeAgentId: TARGET_AGENT_ID }),
    );
  });
});
