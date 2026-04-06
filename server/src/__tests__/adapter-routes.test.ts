import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { adapterRoutes } from "../routes/adapters.js";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock("../services/agents.js", () => ({
  agentService: () => mockAgentService,
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
  app.use("/api", adapterRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("adapter routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists adapter catalog entries", async () => {
    const res = await request(createApp()).get("/api/adapters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((entry: { type: string }) => entry.type === "openrouter_local")).toBe(true);
  });

  it("returns adapter detail with configuration doc", async () => {
    const res = await request(createApp()).get("/api/adapters/openrouter_local");

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("openrouter_local");
    expect(res.body.configurationDoc).toContain("openrouter_local");
  });
});
