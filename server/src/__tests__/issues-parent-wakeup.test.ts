import { describe, expect, it } from "vitest";
import { shouldWakeParentOnChildStatusChange } from "../routes/issues-parent-wakeup.js";

describe("shouldWakeParentOnChildStatusChange", () => {
  it("wakes the parent assignee when a child becomes done", () => {
    expect(
      shouldWakeParentOnChildStatusChange({
        previousStatus: "in_progress",
        currentStatus: "done",
        parentId: "parent-1",
        parentAssigneeAgentId: "agent-1",
        parentStatus: "in_progress",
      }),
    ).toBe(true);
  });

  it("wakes the parent assignee when a child becomes blocked", () => {
    expect(
      shouldWakeParentOnChildStatusChange({
        previousStatus: "in_progress",
        currentStatus: "blocked",
        parentId: "parent-1",
        parentAssigneeAgentId: "agent-1",
        parentStatus: "todo",
      }),
    ).toBe(true);
  });

  it("does not wake when the child status does not change", () => {
    expect(
      shouldWakeParentOnChildStatusChange({
        previousStatus: "done",
        currentStatus: "done",
        parentId: "parent-1",
        parentAssigneeAgentId: "agent-1",
        parentStatus: "in_progress",
      }),
    ).toBe(false);
  });

  it("does not wake when the parent is already terminal or backlog", () => {
    expect(
      shouldWakeParentOnChildStatusChange({
        previousStatus: "in_progress",
        currentStatus: "done",
        parentId: "parent-1",
        parentAssigneeAgentId: "agent-1",
        parentStatus: "done",
      }),
    ).toBe(false);
    expect(
      shouldWakeParentOnChildStatusChange({
        previousStatus: "in_progress",
        currentStatus: "done",
        parentId: "parent-1",
        parentAssigneeAgentId: "agent-1",
        parentStatus: "backlog",
      }),
    ).toBe(false);
  });

  it("does not wake when the parent or parent assignee is missing", () => {
    expect(
      shouldWakeParentOnChildStatusChange({
        previousStatus: "in_progress",
        currentStatus: "done",
        parentId: null,
        parentAssigneeAgentId: "agent-1",
        parentStatus: "in_progress",
      }),
    ).toBe(false);
    expect(
      shouldWakeParentOnChildStatusChange({
        previousStatus: "in_progress",
        currentStatus: "done",
        parentId: "parent-1",
        parentAssigneeAgentId: null,
        parentStatus: "in_progress",
      }),
    ).toBe(false);
  });
});
