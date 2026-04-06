import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { agentRoutes } from "../routes/agents.js";

const mockListAdapterModels = vi.hoisted(() => vi.fn());
const mockFindServerAdapter = vi.hoisted(() => vi.fn());

const mockAdapterSettingsService = vi.hoisted(() => ({
  get: vi.fn(),
}));

const mockSecretsService = vi.hoisted(() => ({
  resolveAdapterConfigForRuntime: vi.fn(),
  normalizeAdapterConfigForPersistence: vi.fn(),
}));

vi.mock("../adapters/index.js", () => ({
  listAdapterModels: mockListAdapterModels,
  findServerAdapter: mockFindServerAdapter,
}));

vi.mock("../services/index.js", () => ({
  agentService: () => ({
    getById: vi.fn(),
  }),
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
  }),
  approvalService: () => ({}),
  heartbeatService: () => ({}),
  issueApprovalService: () => ({}),
  issueService: () => ({}),
  logActivity: vi.fn(),
  secretService: () => mockSecretsService,
}));

vi.mock("../services/adapter-company-settings.js", () => ({
  adapterCompanySettingsService: () => mockAdapterSettingsService,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api", agentRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("agent adapter routes with company settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapterSettingsService.get.mockResolvedValue(null);
    mockSecretsService.resolveAdapterConfigForRuntime.mockImplementation(async (_companyId, config) => ({
      config,
    }));
    mockSecretsService.normalizeAdapterConfigForPersistence.mockImplementation(async (_companyId, config) => config);
    mockListAdapterModels.mockResolvedValue([]);
    mockFindServerAdapter.mockReturnValue({
      type: "openrouter",
      testEnvironment: vi.fn().mockResolvedValue({
        adapterType: "openrouter",
        status: "pass",
        checks: [],
        testedAt: "2026-04-06T00:00:00.000Z",
      }),
    });
  });

  it("uses saved company adapter settings during model discovery", async () => {
    mockAdapterSettingsService.get.mockResolvedValue({
      settingsJson: {
        env: {
          OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
        },
      },
    });
    mockSecretsService.resolveAdapterConfigForRuntime.mockResolvedValue({
      config: {
        env: {
          OPENROUTER_API_KEY: "resolved-key",
        },
      },
    });

    const res = await request(createApp()).get("/api/companies/company-1/adapters/openrouter/models");

    expect(res.status).toBe(200);
    expect(mockListAdapterModels).toHaveBeenCalledWith("openrouter", {
      companyId: "company-1",
      config: {
        env: {
          OPENROUTER_API_KEY: "resolved-key",
        },
      },
    });
  });

  it("merges saved company adapter settings into test-environment config", async () => {
    const testEnvironment = vi.fn().mockResolvedValue({
      adapterType: "openrouter",
      status: "pass",
      checks: [],
      testedAt: "2026-04-06T00:00:00.000Z",
    });
    mockFindServerAdapter.mockReturnValue({
      type: "openrouter",
      testEnvironment,
    });
    mockAdapterSettingsService.get.mockResolvedValue({
      settingsJson: {
        env: {
          OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
        },
      },
    });
    mockSecretsService.resolveAdapterConfigForRuntime.mockResolvedValue({
      config: {
        env: {
          OPENROUTER_API_KEY: "resolved-key",
        },
        model: "openai/gpt-5",
      },
    });

    const res = await request(createApp())
      .post("/api/companies/company-1/adapters/openrouter/test-environment")
      .send({
        adapterConfig: {
          model: "openai/gpt-5",
        },
      });

    expect(res.status).toBe(200);
    expect(testEnvironment).toHaveBeenCalledWith({
      companyId: "company-1",
      adapterType: "openrouter",
      config: {
        env: {
          OPENROUTER_API_KEY: "resolved-key",
        },
        model: "openai/gpt-5",
      },
    });
  });
});
