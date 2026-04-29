import { describe, expect, it } from "vitest";
import type { AgentWakeupSkipped, HeartbeatRun } from "@paperclipai/shared";
import { resolveTrackedRunRedirect, resolveWakeupTrackingTarget } from "../commands/heartbeat-run.js";

function makeRun(overrides: Partial<HeartbeatRun> = {}): HeartbeatRun {
  return {
    id: "run-1",
    companyId: "company-1",
    agentId: "agent-1",
    invocationSource: "on_demand",
    triggerDetail: "manual",
    status: "queued",
    startedAt: null,
    finishedAt: null,
    error: null,
    wakeupRequestId: "wake-1",
    exitCode: null,
    signal: null,
    usageJson: null,
    resultJson: null,
    sessionIdBefore: null,
    sessionIdAfter: null,
    logStore: null,
    logRef: null,
    logBytes: null,
    logSha256: null,
    logCompressed: false,
    stdoutExcerpt: null,
    stderrExcerpt: null,
    errorCode: null,
    externalRunId: null,
    processPid: null,
    processStartedAt: null,
    retryOfRunId: null,
    processLossRetryCount: 0,
    contextSnapshot: null,
    createdAt: new Date("2026-04-14T12:00:00.000Z"),
    updatedAt: new Date("2026-04-14T12:00:00.000Z"),
    ...overrides,
  };
}

function makeSkipped(overrides: Partial<AgentWakeupSkipped> = {}): AgentWakeupSkipped {
  return {
    status: "skipped",
    reason: "wakeup_skipped",
    message: "Wakeup was skipped.",
    issueId: null,
    executionRunId: null,
    executionAgentId: null,
    executionAgentName: null,
    ...overrides,
  };
}

describe("resolveWakeupTrackingTarget", () => {
  it("tracks the invoked run when wakeup returns a run", () => {
    const result = resolveWakeupTrackingTarget(makeRun({ id: "run-123" }));
    expect(result).toEqual({
      runId: "run-123",
      message: "Invoked heartbeat run run-123 for agent execution",
    });
  });

  it("follows executionRunId when wakeup is deferred behind an active issue execution", () => {
    const result = resolveWakeupTrackingTarget(
      makeSkipped({
        reason: "issue_execution_deferred",
        message: "Wakeup was deferred because this issue is already being executed.",
        executionRunId: "run-active",
      }),
    );

    expect(result).toEqual({
      runId: "run-active",
      message: "Wakeup was deferred because this issue is already being executed.",
    });
  });

  it("returns no runId for a plain skipped wakeup", () => {
    const result = resolveWakeupTrackingTarget(makeSkipped());
    expect(result.runId).toBeNull();
  });
});

describe("resolveTrackedRunRedirect", () => {
  it("switches from a queued invoked run to the only active running run", () => {
    const redirected = resolveTrackedRunRedirect("run-queued", [
      makeRun({ id: "run-queued", status: "queued" }),
      makeRun({ id: "run-active", status: "running", invocationSource: "assignment" }),
    ]);

    expect(redirected?.id).toBe("run-active");
  });

  it("does not redirect when the tracked run is already running", () => {
    const redirected = resolveTrackedRunRedirect("run-active", [
      makeRun({ id: "run-active", status: "running" }),
      makeRun({ id: "run-queued", status: "queued" }),
    ]);

    expect(redirected).toBeNull();
  });

  it("does not redirect when there are multiple running runs", () => {
    const redirected = resolveTrackedRunRedirect("run-queued", [
      makeRun({ id: "run-queued", status: "queued" }),
      makeRun({ id: "run-active-1", status: "running" }),
      makeRun({ id: "run-active-2", status: "running" }),
    ]);

    expect(redirected).toBeNull();
  });
});
