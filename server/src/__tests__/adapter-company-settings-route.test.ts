import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { adapterCompanySettingsRoutes } from "../routes/adapter-company-settings.js";

const mockSettingsService = vi.hoisted(() => ({
  get: vi.fn(),
  upsert: vi.fn(),
}));

const mockSecretsService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  adapterCompanySettingsService: () => mockSettingsService,
  secretService: () => mockSecretsService,
  logActivity: mockLogActivity,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", adapterCompanySettingsRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("adapter company settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty settings when none are stored", async () => {
    mockSettingsService.get.mockResolvedValue(null);

    const res = await request(createApp()).get("/api/companies/company-1/adapters/openrouter/settings");

    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.settingsJson).toEqual({});
  });

  it("normalizes and persists settings", async () => {
    mockSecretsService.normalizeAdapterConfigForPersistence.mockResolvedValue({
      env: {
        OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
      },
    });
    mockSettingsService.upsert.mockResolvedValue({
      settingsJson: {
        env: {
          OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
        },
      },
      updatedAt: new Date("2026-04-06T20:00:00.000Z"),
    });

    const res = await request(createApp())
      .patch("/api/companies/company-1/adapters/openrouter/settings")
      .send({
        settingsJson: {
          env: {
            OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
          },
        },
      });

    expect(res.status).toBe(200);
    expect(mockSecretsService.normalizeAdapterConfigForPersistence).toHaveBeenCalledWith("company-1", {
      env: {
        OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
      },
    });
    expect(mockSettingsService.upsert).toHaveBeenCalledWith(
      "company-1",
      "openrouter",
      {
        env: {
          OPENROUTER_API_KEY: { type: "secret_ref", secretId: "secret-1", version: "latest" },
        },
      },
    );
    expect(res.body.configured).toBe(true);
  });
});
