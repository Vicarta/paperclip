import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
  assertCheckoutOwner: vi.fn(),
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

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: ISSUE_ID,
    companyId: COMPANY_ID,
    projectId: null,
    goalId: null,
    parentId: null,
    title: "Blocking label test",
    description: null,
    status: "in_progress",
    priority: "medium",
    assigneeAgentId: ACTOR_AGENT_ID,
    assigneeUserId: null,
    checkoutRunId: "run-1",
    executionRunId: "run-1",
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: "user-1",
    issueNumber: 100,
    identifier: "TST-100",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceSettings: null,
    startedAt: new Date("2026-04-01T00:00:00.000Z"),
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    labels: [],
    labelIds: [],
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

describe("issue human decision label route behavior", () => {
  beforeEach(() => {
    mockIssueService.getById.mockReset();
    mockIssueService.getByIdentifier.mockReset();
    mockIssueService.update.mockReset();
    mockIssueService.addComment.mockReset();
    mockIssueService.assertCheckoutOwner.mockReset();
    mockIssueService.findMentionedAgents.mockReset();
    mockAccessService.canUser.mockReset();
    mockAccessService.hasPermission.mockReset();
    mockAgentService.getById.mockReset();
    mockHeartbeatService.wakeup.mockReset();
    mockLogActivity.mockReset();

    mockIssueService.getById.mockResolvedValue(makeIssue());
    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.addComment.mockResolvedValue({
      id: "comment-1",
      issueId: ISSUE_ID,
      authorAgentId: ACTOR_AGENT_ID,
      authorUserId: null,
      body: "Blocking clarification. Human Decision Needed.",
      createdAt: new Date("2026-04-01T00:01:00.000Z"),
    });
    mockIssueService.assertCheckoutOwner.mockResolvedValue({ adoptedFromRunId: null });
    mockIssueService.findMentionedAgents.mockResolvedValue([]);
    mockAccessService.hasPermission.mockResolvedValue(false);
    mockAgentService.getById.mockResolvedValue({
      id: ACTOR_AGENT_ID,
      companyId: COMPANY_ID,
      role: "blog-brief-strategist",
      permissions: null,
    });
    mockHeartbeatService.wakeup.mockResolvedValue({ id: "run-2" });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("accepts explicit blocking comments and leaves label enforcement to the issue service layer", async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/comments`)
      .set("X-Paperclip-Run-Id", "run-1")
      .send({ body: "Blocking clarification. Human Decision Needed." });

    expect(res.status).toBe(201);
    expect(mockIssueService.addComment).toHaveBeenCalled();
  });

  it("accepts non-blocking comments without direct route-level label sync", async () => {
    mockIssueService.addComment.mockResolvedValue({
      id: "comment-2",
      issueId: ISSUE_ID,
      authorAgentId: ACTOR_AGENT_ID,
      authorUserId: null,
      body: "Non-blocking follow-up only.",
      createdAt: new Date("2026-04-01T00:02:00.000Z"),
    });

    const app = createApp();
    const res = await request(app)
      .post(`/api/issues/${ISSUE_ID}/comments`)
      .set("X-Paperclip-Run-Id", "run-1")
      .send({ body: "Non-blocking follow-up only." });

    expect(res.status).toBe(201);
    expect(mockIssueService.addComment).toHaveBeenCalled();
  });
});
