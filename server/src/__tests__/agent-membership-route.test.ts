import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentRoutes } from "../routes/agents.js";
import { errorHandler } from "../middleware/index.js";

const mockAgentService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
  listKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeKey: vi.fn(),
  updatePermissions: vi.fn(),
  update: vi.fn(),
  getChainOfCommand: vi.fn(),
  resolveByReference: vi.fn(),
  orgForCompany: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
  ensureMembership: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  listTaskSessions: vi.fn(),
  resetRuntimeSession: vi.fn(),
  wakeup: vi.fn(),
  getActiveRunForAgent: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  linkManyForApproval: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
  resolveAdapterConfigForRuntime: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  accessService: () => mockAccessService,
  approvalService: () => mockApprovalService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  secretService: () => mockSecretService,
  logActivity: mockLogActivity,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      source: "local_implicit",
      userId: "local-board",
      companyIds: ["company-1"],
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api", agentRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("POST /companies/:companyId/agents", () => {
  beforeEach(() => {
    mockAgentService.create.mockReset();
    mockAccessService.ensureMembership.mockReset();
    mockSecretService.normalizeAdapterConfigForPersistence.mockReset();
    mockLogActivity.mockReset();

    mockSecretService.normalizeAdapterConfigForPersistence.mockImplementation(async (_companyId, config) => config);
    mockAccessService.ensureMembership.mockResolvedValue({
      id: "membership-1",
      companyId: "company-1",
      principalType: "agent",
      principalId: "agent-1",
      status: "active",
      membershipRole: "member",
    });
    mockAgentService.create.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      name: "Manager Smoke",
      role: "cmo",
      title: "Manager Smoke",
      status: "idle",
    });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("creates a company membership for newly created agents", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/companies/company-1/agents")
      .send({
        name: "Manager Smoke",
        role: "cmo",
        title: "Manager Smoke",
        adapterType: "process",
      });

    expect(res.status).toBe(201);
    expect(mockAgentService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        name: "Manager Smoke",
        role: "cmo",
        title: "Manager Smoke",
        adapterType: "process",
        status: "idle",
      }),
    );
    expect(mockAccessService.ensureMembership).toHaveBeenCalledWith(
      "company-1",
      "agent",
      "agent-1",
      "member",
      "active",
    );
  });
});
