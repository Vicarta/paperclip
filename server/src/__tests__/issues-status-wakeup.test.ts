import { describe, expect, it } from "vitest";
import { shouldWakeAssigneeOnStatusChange } from "../routes/issues-status-wakeup.js";

describe("shouldWakeAssigneeOnStatusChange", () => {
  it("wakes when an issue is unblocked to todo", () => {
    expect(
      shouldWakeAssigneeOnStatusChange({
        previousStatus: "blocked",
        currentStatus: "todo",
      }),
    ).toBe(true);
  });

  it("wakes when backlog is promoted to in_progress", () => {
    expect(
      shouldWakeAssigneeOnStatusChange({
        previousStatus: "backlog",
        currentStatus: "in_progress",
      }),
    ).toBe(true);
  });

  it("does not wake for transitions within active statuses", () => {
    expect(
      shouldWakeAssigneeOnStatusChange({
        previousStatus: "todo",
        currentStatus: "in_progress",
      }),
    ).toBe(false);
  });

  it("does not wake when moving to blocked", () => {
    expect(
      shouldWakeAssigneeOnStatusChange({
        previousStatus: "todo",
        currentStatus: "blocked",
      }),
    ).toBe(false);
  });

  it("does not wake when status is unchanged", () => {
    expect(
      shouldWakeAssigneeOnStatusChange({
        previousStatus: "blocked",
        currentStatus: "blocked",
      }),
    ).toBe(false);
  });
});
