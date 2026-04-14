import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  companySecretVersions,
  companySecrets,
  costEvents,
  createDb,
  pluginConfig,
  pluginState,
  plugins,
} from "@paperclipai/db";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import { reconcileBrightDataCosts } from "../services/bright-data-cost-reconciler.ts";
import { secretService } from "../services/secrets.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres Bright Data reconciler tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("bright data cost reconciler", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const originalMasterKey = process.env.PAPERCLIP_SECRETS_MASTER_KEY;

  beforeAll(async () => {
    process.env.PAPERCLIP_SECRETS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-bright-data-costs-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(pluginState);
    await db.delete(costEvents);
    await db.delete(pluginConfig);
    await db.delete(companySecretVersions);
    await db.delete(companySecrets);
    await db.delete(plugins);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    if (originalMasterKey === undefined) {
      delete process.env.PAPERCLIP_SECRETS_MASTER_KEY;
    } else {
      process.env.PAPERCLIP_SECRETS_MASTER_KEY = originalMasterKey;
    }
    await tempDb?.cleanup();
  });

  async function seedFixture() {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const pluginId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Finance Sink",
      role: "ops",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip.bright-data-agent-tools",
      packageName: "@paperclipai/plugin-bright-data-agent-tools",
      version: "0.3.1",
      apiVersion: 1,
      categories: [],
      manifestJson: {
        id: "paperclip.bright-data-agent-tools",
        name: "Bright Data Agent Tools",
        version: "0.3.1",
        apiVersion: 1,
      } as any,
      status: "installed",
      packagePath: "/app/packages/plugins/plugin-bright-data-agent-tools",
    });

    const secret = await secretService(db).create(companyId, {
      name: "Bright Data token",
      provider: "local_encrypted",
      value: "token-123",
    });

    await db.insert(pluginConfig).values({
      pluginId,
      configJson: {
        brightDataTokenSecretRef: secret.id,
      },
    });

    return { companyId, agentId, pluginId };
  }

  function createFetchStub() {
    return async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      if (url.pathname === "/zone/get_all_zones") {
        return new Response(JSON.stringify([
          { name: "mcp_unlocker", type: "unblocker", status: "active" },
          { name: "other_zone", type: "unblocker", status: "active" },
        ]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.pathname === "/zone/cost") {
        return new Response(JSON.stringify({
          hl_test: {
            back_d2: {
              cost: 0.003,
              range: { from: "12-Apr-2026", to: "13-Apr-2026" },
            },
            back_d1: {
              cost: 0.012,
              range: { from: "13-Apr-2026", to: "14-Apr-2026" },
            },
            back_d0: {
              cost: 0.099,
              range: { from: "14-Apr-2026", to: "15-Apr-2026" },
            },
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected URL: ${url.toString()}`);
    };
  }

  it("does not persist cost events or state in dry-run mode", async () => {
    const { companyId, agentId } = await seedFixture();

    const result = await reconcileBrightDataCosts(db, {
      companyId,
      apply: false,
      now: new Date("2026-04-14T12:00:00.000Z"),
    }, {
      fetchFn: createFetchStub() as typeof fetch,
    });

    expect(result.apply).toBe(false);
    expect(result.agentId).toBeNull();
    expect(result.zonesConsidered).toEqual(["mcp_unlocker"]);
    expect(result.dryRunEvents).toHaveLength(1);
    expect(result.dryRunEvents[0]).toMatchObject({
      zoneName: "mcp_unlocker",
      bucketKey: "back_d1",
      costCents: 1,
    });

    const storedEvents = await db.select().from(costEvents);
    const storedState = await db.select().from(pluginState);
    expect(storedEvents).toHaveLength(0);
    expect(storedState).toHaveLength(0);
  });

  it("writes aggregate cost events idempotently and carries sub-cent residuals", async () => {
    const { companyId, agentId } = await seedFixture();

    const first = await reconcileBrightDataCosts(db, {
      companyId,
      agentId,
      apply: true,
      now: new Date("2026-04-14T12:00:00.000Z"),
    }, {
      fetchFn: createFetchStub() as typeof fetch,
    });

    expect(first.eventsCreated).toBe(1);
    expect(first.emittedCostCents).toBe(1);

    const storedEventsAfterFirst = await db.select().from(costEvents);
    expect(storedEventsAfterFirst).toHaveLength(1);
    expect(storedEventsAfterFirst[0]).toMatchObject({
      companyId,
      agentId,
      provider: "brightdata.com",
      biller: "brightdata.com",
      billingType: "metered_api",
      model: "zone:mcp_unlocker:daily_aggregate",
      costCents: 1,
    });

    const carryState = await db
      .select()
      .from(pluginState)
      .where(eq(pluginState.stateKey, "carry:hl_test:mcp_unlocker"));
    expect(carryState).toHaveLength(1);
    expect(carryState[0]?.valueJson).toMatchObject({
      carryMilliCents: 5,
    });

    const second = await reconcileBrightDataCosts(db, {
      companyId,
      agentId,
      apply: true,
      now: new Date("2026-04-14T12:05:00.000Z"),
    }, {
      fetchFn: createFetchStub() as typeof fetch,
    });

    expect(second.eventsCreated).toBe(0);
    expect(second.emittedCostCents).toBe(0);

    const storedEventsAfterSecond = await db.select().from(costEvents);
    expect(storedEventsAfterSecond).toHaveLength(1);
  });
});
