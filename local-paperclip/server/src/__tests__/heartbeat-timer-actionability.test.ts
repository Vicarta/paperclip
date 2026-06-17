import { describe, expect, it } from "vitest";
import { findPreviousRawUsageBaseline, isActionableForTimerHeartbeat } from "../services/heartbeat.js";

describe("isActionableForTimerHeartbeat", () => {
  const lastHeartbeatAt = new Date("2026-05-22T07:00:00.000Z");

  it("treats assigned todo work as actionable", () => {
    expect(
      isActionableForTimerHeartbeat({
        issueStatus: "todo",
        issueUpdatedAt: new Date("2026-05-21T20:00:00.000Z"),
        lastHeartbeatAt,
      }),
    ).toBe(true);
  });

  it("does not treat unchanged in-progress work as actionable", () => {
    expect(
      isActionableForTimerHeartbeat({
        issueStatus: "in_progress",
        issueUpdatedAt: new Date("2026-05-22T06:59:00.000Z"),
        latestCommentAt: new Date("2026-05-22T06:58:00.000Z"),
        lastHeartbeatAt,
      }),
    ).toBe(false);
  });

  it("treats new issue activity after the previous heartbeat as actionable", () => {
    expect(
      isActionableForTimerHeartbeat({
        issueStatus: "in_progress",
        issueUpdatedAt: new Date("2026-05-22T07:01:00.000Z"),
        lastHeartbeatAt,
      }),
    ).toBe(true);
  });

  it("treats new comments after the previous heartbeat as actionable", () => {
    expect(
      isActionableForTimerHeartbeat({
        issueStatus: "blocked",
        issueUpdatedAt: new Date("2026-05-22T06:00:00.000Z"),
        latestCommentAt: new Date("2026-05-22T07:02:00.000Z"),
        lastHeartbeatAt,
      }),
    ).toBe(true);
  });

  it("ignores non-executable issue states", () => {
    expect(
      isActionableForTimerHeartbeat({
        issueStatus: "done",
        issueUpdatedAt: new Date("2026-05-22T07:02:00.000Z"),
        latestCommentAt: new Date("2026-05-22T07:02:00.000Z"),
        lastHeartbeatAt,
      }),
    ).toBe(false);
  });
});

describe("findPreviousRawUsageBaseline", () => {
  it("skips failed or zero-usage session runs when choosing a delta baseline", () => {
    expect(
      findPreviousRawUsageBaseline([
        { usageJson: null },
        { usageJson: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } },
        {
          usageJson: {
            inputTokens: 120,
            cachedInputTokens: 30,
            outputTokens: 20,
            rawInputTokens: 3_000,
            rawCachedInputTokens: 500,
            rawOutputTokens: 400,
          },
        },
      ]),
    ).toEqual({
      inputTokens: 3_000,
      cachedInputTokens: 500,
      outputTokens: 400,
    });
  });
});
