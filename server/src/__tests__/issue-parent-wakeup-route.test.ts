import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi, waitFor } from "vitest";
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
const CHILD_ISSUE_ID = "22222222-2222-2222-2222-222222222222";
const PARENT_ISSUE_ID = "44444444-4444-4444-4444-444444444444";
const ACTOR_AGENT_ID = "33333333-3333-3333-3333-333333333333";
const PARENT_AGENT_ID = "55555555-5555-5555-5555-555555555555";

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: CHILD_ISSUE_ID,
    companyId: COMPANY_ID,
    projectId: null,
    goalId: null,
    parentId: PARENT_ISSUE_ID,
    title: "Child issue",
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
    issueNumber: 150,
    identifier: "TST-150",
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
      source: "agent_jwt",
      runId: "run-1",
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue parent wakeup route behavior", () => {
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

    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.addComment.mockResolvedValue(null);
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

  it("wakes the parent assignee when a child is marked done", async () => {
    const existing = makeIssue();
    const updated = makeIssue({
      status: "done",
      executionRunId: null,
      checkoutRunId: null,
      completedAt: new Date("2026-04-01T00:05:00.000Z"),
    });
    const parent = makeIssue({
      id: PARENT_ISSUE_ID,
      parentId: null,
      status: "in_progress",
      assigneeAgentId: PARENT_AGENT_ID,
      checkoutRunId: "parent-run-1",
      executionRunId: null,
      identifier: "TST-149",
      title: "Parent issue",
    });

    mockIssueService.getById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(parent);
    mockIssueService.update.mockResolvedValue(updated);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/issues/${CHILD_ISSUE_ID}`)
      .set("X-Paperclip-Run-Id", "run-1")
      .send({ status: "done" });

    expect(res.status).toBe(200);

    await waitFor(() => {
      expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
        PARENT_AGENT_ID,
        expect.objectContaining({
          reason: "child_issue_status_changed",
          payload: expect.objectContaining({
            issueId: PARENT_ISSUE_ID,
            childIssueId: CHILD_ISSUE_ID,
            childStatus: "done",
          }),
        }),
      );
    });
  });
});
