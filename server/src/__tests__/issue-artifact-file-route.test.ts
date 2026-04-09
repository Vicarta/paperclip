import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
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

const mockProjectService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

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
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const WORKSPACE_ID = "44444444-4444-4444-4444-444444444444";
const AGENT_ID = "55555555-5555-5555-5555-555555555555";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "agent",
      agentId: AGENT_ID,
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

describe("issue artifact file route", () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-issue-artifact-"));
    mockIssueService.getById.mockReset();
    mockIssueService.getByIdentifier.mockReset();
    mockProjectService.getById.mockReset();
    mockLogActivity.mockReset();

    mockIssueService.getById.mockResolvedValue({
      id: ISSUE_ID,
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      identifier: "AST-152",
      status: "in_progress",
      assigneeAgentId: AGENT_ID,
    });
    mockProjectService.getById.mockResolvedValue({
      id: PROJECT_ID,
      companyId: COMPANY_ID,
      primaryWorkspace: {
        id: WORKSPACE_ID,
        cwd: workspaceRoot,
      },
      workspaces: [],
    });
    mockLogActivity.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it("writes a canonical artifact file inside the primary workspace", async () => {
    const app = createApp();
    const relativePath = "work/59-seo-blog-article-drafts/active/ast-152-money-ua-2026-04-07.md";
    const body = "# Draft\n\nBody";

    const res = await request(app)
      .put(`/api/issues/${ISSUE_ID}/artifacts/file`)
      .set("X-Paperclip-Run-Id", "run-1")
      .send({ relativePath, body });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        relativePath,
        workspaceId: WORKSPACE_ID,
        bytes: Buffer.byteLength(body, "utf8"),
      }),
    );

    const written = await fs.readFile(path.join(workspaceRoot, relativePath), "utf8");
    expect(written).toBe(body);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: COMPANY_ID,
        action: "issue.artifact_file_written",
        entityId: ISSUE_ID,
        details: expect.objectContaining({
          relativePath,
          workspaceId: WORKSPACE_ID,
        }),
      }),
    );
  });

  it("rejects traversal outside the project workspace", async () => {
    const app = createApp();

    const res = await request(app)
      .put(`/api/issues/${ISSUE_ID}/artifacts/file`)
      .set("X-Paperclip-Run-Id", "run-1")
      .send({ relativePath: "../escape.md", body: "nope" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inside the project workspace/i);
  });
});
