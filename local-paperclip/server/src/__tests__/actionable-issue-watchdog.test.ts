import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agentWakeupRequests,
  agents,
  companies,
  createDb,
  heartbeatRuns,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { actionableIssueWatchdogService } from "../services/actionable-issue-watchdog.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres actionable issue watchdog tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("actionableIssueWatchdogService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-actionable-watchdog-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompanyAndAgent() {
    const companyId = randomUUID();
    const agentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Operator",
      role: "operator",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });
    return { companyId, agentId };
  }

  it("queues stale assigned actionable issues without filtering by priority", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const now = new Date("2026-05-27T12:00:00.000Z");
    const staleUpdatedAt = new Date("2026-05-27T11:50:00.000Z");
    const lowIssueId = randomUUID();
    const mediumIssueId = randomUUID();

    await db.insert(issues).values([
      {
        id: lowIssueId,
        companyId,
        title: "Low priority actionable issue",
        status: "todo",
        priority: "low",
        assigneeAgentId: agentId,
        updatedAt: staleUpdatedAt,
      },
      {
        id: mediumIssueId,
        companyId,
        title: "Medium priority actionable issue",
        status: "todo",
        priority: "medium",
        assigneeAgentId: agentId,
        updatedAt: staleUpdatedAt,
      },
    ]);

    const heartbeat = { wakeup: vi.fn(async () => ({ queued: true })) };
    const result = await actionableIssueWatchdogService(db, heartbeat).tick({
      now,
      staleThresholdMs: 5 * 60 * 1000,
      maxWakeupsPerAgent: 10,
    });

    expect(result).toMatchObject({ checked: 2, queued: 2, skipped: 0, failed: 0 });
    expect(heartbeat.wakeup).toHaveBeenCalledTimes(2);
    expect(heartbeat.wakeup.mock.calls.map((call) => call[1]?.payload?.issueId).sort()).toEqual(
      [lowIssueId, mediumIssueId].sort(),
    );
  });

  it("limits newly queued wakeups per agent by default to preserve token budget", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const now = new Date("2026-05-27T12:00:00.000Z");
    const staleUpdatedAt = new Date("2026-05-27T11:50:00.000Z");

    await db.insert(issues).values([
      {
        id: randomUUID(),
        companyId,
        title: "Oldest issue",
        status: "todo",
        priority: "low",
        assigneeAgentId: agentId,
        updatedAt: staleUpdatedAt,
      },
      {
        id: randomUUID(),
        companyId,
        title: "Second issue",
        status: "todo",
        priority: "high",
        assigneeAgentId: agentId,
        updatedAt: staleUpdatedAt,
      },
    ]);

    const heartbeat = { wakeup: vi.fn(async () => ({ queued: true })) };
    const result = await actionableIssueWatchdogService(db, heartbeat).tick({
      now,
      staleThresholdMs: 5 * 60 * 1000,
    });

    expect(result).toMatchObject({ checked: 2, queued: 1, skipped: 1, failed: 0 });
    expect(heartbeat.wakeup).toHaveBeenCalledOnce();
  });

  it("skips stale issues that already have active wakeup or run evidence", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const now = new Date("2026-05-27T12:00:00.000Z");
    const staleUpdatedAt = new Date("2026-05-27T11:50:00.000Z");
    const queuedIssueId = randomUUID();
    const runningIssueId = randomUUID();
    const eligibleIssueId = randomUUID();

    await db.insert(issues).values([
      {
        id: queuedIssueId,
        companyId,
        title: "Issue with active wakeup",
        status: "todo",
        priority: "low",
        assigneeAgentId: agentId,
        updatedAt: staleUpdatedAt,
      },
      {
        id: runningIssueId,
        companyId,
        title: "Issue with active run",
        status: "todo",
        priority: "medium",
        assigneeAgentId: agentId,
        updatedAt: staleUpdatedAt,
      },
      {
        id: eligibleIssueId,
        companyId,
        title: "Eligible issue",
        status: "todo",
        priority: "high",
        assigneeAgentId: agentId,
        updatedAt: staleUpdatedAt,
      },
    ]);

    await db.insert(agentWakeupRequests).values({
      companyId,
      agentId,
      source: "automation",
      triggerDetail: "system",
      reason: "existing",
      payload: { issueId: queuedIssueId },
      status: "queued",
    });
    await db.insert(heartbeatRuns).values({
      companyId,
      agentId,
      invocationSource: "automation",
      status: "running",
      contextSnapshot: { issueId: runningIssueId },
    });

    const heartbeat = { wakeup: vi.fn(async () => ({ queued: true })) };
    const result = await actionableIssueWatchdogService(db, heartbeat).tick({
      now,
      staleThresholdMs: 5 * 60 * 1000,
    });

    expect(result).toMatchObject({ checked: 3, queued: 1, skipped: 2, failed: 0 });
    expect(heartbeat.wakeup).toHaveBeenCalledOnce();
    expect(heartbeat.wakeup).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({
        reason: "stale_actionable_issue",
        payload: expect.objectContaining({ issueId: eligibleIssueId }),
      }),
    );
  });

  it("does not treat an orphaned deferred issue wakeup as active run evidence", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const now = new Date("2026-05-27T12:00:00.000Z");
    const staleUpdatedAt = new Date("2026-05-27T11:50:00.000Z");
    const issueId = randomUUID();

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Issue with orphaned deferred wakeup",
      status: "todo",
      priority: "medium",
      assigneeAgentId: agentId,
      updatedAt: staleUpdatedAt,
    });
    await db.insert(agentWakeupRequests).values({
      companyId,
      agentId,
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_execution_deferred",
      payload: { issueId },
      status: "deferred_issue_execution",
    });

    const heartbeat = { wakeup: vi.fn(async () => ({ queued: true })) };
    const result = await actionableIssueWatchdogService(db, heartbeat).tick({
      now,
      staleThresholdMs: 5 * 60 * 1000,
    });

    expect(result).toMatchObject({ checked: 1, queued: 1, skipped: 0, failed: 0 });
    expect(heartbeat.wakeup).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({
        reason: "stale_actionable_issue",
        payload: expect.objectContaining({ issueId }),
      }),
    );
  });
});
