import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, pluginJobRuns, plugins } from "@paperclipai/db";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import { createPluginJobScheduler } from "../services/plugin-job-scheduler.js";
import { pluginJobStore } from "../services/plugin-job-store.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres plugin job scheduler tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("plugin job scheduler", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-plugin-job-scheduler-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.execute(`
      TRUNCATE TABLE
        plugin_job_runs,
        plugin_jobs,
        plugins
      CASCADE
    `);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("auto-pauses a scheduled job after a missing handler error and does not retry it on the next tick", async () => {
    const pluginId = randomUUID();
    const jobKey = "missing-scheduled-handler";
    const startedAt = new Date("2026-04-15T00:00:00.000Z");
    const jobStore = pluginJobStore(db);
    const scheduler = createPluginJobScheduler({
      db,
      jobStore,
      workerManager: {
        isRunning: vi.fn(() => true),
        call: vi.fn(async () => {
          throw new Error(`No handler registered for job "${jobKey}"`);
        }),
      } as never,
      tickIntervalMs: 1_000,
      jobTimeoutMs: 1_000,
    });

    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "telegram.notifications",
      packageName: "paperclip-plugin-telegram",
      version: "0.3.0",
      apiVersion: 1,
      categories: [],
      manifestJson: { id: "telegram.notifications", apiVersion: 1, version: "0.3.0" } as never,
      status: "ready",
    });

    await jobStore.syncJobDeclarations(pluginId, [
      {
        jobKey,
        displayName: "Daily digest",
        schedule: "0 * * * *",
      },
    ]);

    const job = await jobStore.getJobByKey(pluginId, jobKey);
    expect(job).not.toBeNull();

    await jobStore.updateRunTimestamps(job!.id, startedAt, startedAt);

    await scheduler.tick();

    const pausedJob = await jobStore.getJobByKey(pluginId, jobKey);
    expect(pausedJob).not.toBeNull();
    expect(pausedJob!.status).toBe("paused");
    expect(pausedJob!.nextRunAt).toBeNull();

    const runsAfterFirstTick = await db
      .select()
      .from(pluginJobRuns)
      .where(eq(pluginJobRuns.jobId, job!.id));
    expect(runsAfterFirstTick).toHaveLength(1);
    expect(runsAfterFirstTick[0]!.status).toBe("failed");
    expect(runsAfterFirstTick[0]!.error).toContain("No handler registered for job");

    await scheduler.tick();

    const runsAfterSecondTick = await db
      .select()
      .from(pluginJobRuns)
      .where(eq(pluginJobRuns.jobId, job!.id));
    expect(runsAfterSecondTick).toHaveLength(1);
  });
});
