import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHostClientHandlers } from "../../../packages/plugins/sdk/src/host-client-factory.js";
import { PLUGIN_RPC_ERROR_CODES } from "../../../packages/plugins/sdk/src/protocol.js";
import { buildHostServices } from "../services/plugin-host-services.js";

const mockCreateEvent = vi.hoisted(() => vi.fn());
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/costs.js", () => ({
  costService: () => ({
    createEvent: mockCreateEvent,
  }),
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: mockLogActivity,
}));

function createEventBusStub() {
  return {
    forPlugin() {
      return {
        emit: vi.fn(),
        subscribe: vi.fn(),
      };
    },
  } as any;
}

describe("plugin cost bridge", () => {
  beforeEach(() => {
    mockCreateEvent.mockReset();
    mockLogActivity.mockReset();
  });

  it("writes plugin-originated cost events through the host bridge", async () => {
    mockCreateEvent.mockResolvedValue({
      id: "cost-1",
      companyId: "company-1",
      agentId: "agent-1",
      issueId: null,
      projectId: "project-1",
      goalId: null,
      heartbeatRunId: null,
      billingCode: null,
      provider: "serper",
      biller: "serper",
      billingType: "metered_api",
      model: "search-api",
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      costCents: 12,
      occurredAt: new Date("2026-04-14T10:00:00.000Z"),
      createdAt: new Date("2026-04-14T10:00:01.000Z"),
    });

    const services = buildHostServices(
      {} as never,
      "plugin-record-id",
      "seo.serper",
      createEventBusStub(),
    );
    const handlers = createHostClientHandlers({
      pluginId: "seo.serper",
      capabilities: ["costs.write"],
      services,
    });

    const result = await handlers["costs.createEvent"]({
      companyId: "company-1",
      agentId: "agent-1",
      projectId: "project-1",
      provider: "serper",
      biller: "serper",
      billingType: "metered_api",
      model: "search-api",
      costCents: 12,
      occurredAt: "2026-04-14T10:00:00.000Z",
    });

    expect(mockCreateEvent).toHaveBeenCalledWith("company-1", {
      agentId: "agent-1",
      issueId: null,
      projectId: "project-1",
      goalId: null,
      heartbeatRunId: null,
      billingCode: null,
      provider: "serper",
      biller: "serper",
      billingType: "metered_api",
      model: "search-api",
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      costCents: 12,
      occurredAt: new Date("2026-04-14T10:00:00.000Z"),
    });
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: "cost-1",
      companyId: "company-1",
      provider: "serper",
      biller: "serper",
      costCents: 12,
      occurredAt: "2026-04-14T10:00:00.000Z",
      createdAt: "2026-04-14T10:00:01.000Z",
    });
  });

  it("rejects plugin cost writes when the capability is missing", async () => {
    const services = buildHostServices(
      {} as never,
      "plugin-record-id",
      "seo.serper",
      createEventBusStub(),
    );
    const handlers = createHostClientHandlers({
      pluginId: "seo.serper",
      capabilities: [],
      services,
    });

    await expect(
      handlers["costs.createEvent"]({
        companyId: "company-1",
        agentId: "agent-1",
        provider: "serper",
        model: "search-api",
        costCents: 12,
        occurredAt: "2026-04-14T10:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: PLUGIN_RPC_ERROR_CODES.CAPABILITY_DENIED,
    });

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });
});
