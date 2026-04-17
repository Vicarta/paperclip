import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const issueId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockIssueNotificationContractsService = vi.hoisted(() => ({
  getForIssue: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({ canUser: vi.fn(), hasPermission: vi.fn() }),
  agentService: () => ({}),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  feedbackService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => ({
    wakeup: vi.fn(async () => undefined),
    reportRunActivity: vi.fn(async () => undefined),
  }),
  instanceSettingsService: () => ({
    getExperimental: vi.fn(async () => ({})),
    getGeneral: vi.fn(async () => ({ feedbackDataSharingPreference: "prompt" })),
  }),
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: vi.fn(async () => undefined),
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({}),
}));

vi.mock("../services/issue-notification-contracts.js", () => ({
  issueNotificationContractService: () => mockIssueNotificationContractsService,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue notification contract routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getById.mockResolvedValue({
      id: issueId,
      companyId,
      identifier: "AST-512",
      title: "Article ready",
      status: "done",
    });
  });

  it("returns the resolved telegram notification contract preview", async () => {
    mockIssueNotificationContractsService.getForIssue.mockResolvedValue({
      key: "notification-contract",
      documentId: "document-1",
      revisionId: "revision-1",
      contract: {
        version: 1,
        enabled: true,
        channel: "telegram",
        trigger: "issue_done",
        delivery: {
          mode: "attach_file",
          artifact: { source: "issue_attachment", filenameIncludes: "article" },
        },
      },
      attachment: {
        id: "attachment-1",
        issueId,
        contentPath: "/api/attachments/attachment-1/content",
      },
      attachments: [
        {
          id: "attachment-1",
          issueId,
          contentPath: "/api/attachments/attachment-1/content",
        },
      ],
    });

    const res = await request(createApp()).get(`/api/issues/${issueId}/notification-contracts/telegram`);

    expect(res.status).toBe(200);
    expect(mockIssueNotificationContractsService.getForIssue).toHaveBeenCalledWith(issueId);
    expect(res.body).toEqual(
      expect.objectContaining({
        key: "notification-contract",
        contract: expect.objectContaining({
          channel: "telegram",
        }),
        attachment: expect.objectContaining({
          id: "attachment-1",
        }),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            id: "attachment-1",
          }),
        ]),
      }),
    );
  });

  it("returns 422 when the contract document is invalid", async () => {
    mockIssueNotificationContractsService.getForIssue.mockRejectedValue(
      new Error("Notification contract document must contain a JSON object or a fenced ```json``` block."),
    );

    const res = await request(createApp()).get(`/api/issues/${issueId}/notification-contracts/telegram`);

    expect(res.status).toBe(422);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Notification contract document"),
      }),
    );
  });
});
