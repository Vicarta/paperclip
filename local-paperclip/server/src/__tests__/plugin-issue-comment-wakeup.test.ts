import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHostClientHandlers } from "../../../packages/plugins/sdk/src/host-client-factory.js";
import { buildHostServices } from "../services/plugin-host-services.js";

const mockGetById = vi.hoisted(() => vi.fn());
const mockAddComment = vi.hoisted(() => vi.fn());
const mockFindMentionedAgents = vi.hoisted(() => vi.fn());
const mockWakeup = vi.hoisted(() => vi.fn());

vi.mock("../services/issues.js", () => ({
  issueService: () => ({
    getById: mockGetById,
    addComment: mockAddComment,
    findMentionedAgents: mockFindMentionedAgents,
  }),
}));

vi.mock("../services/heartbeat.js", () => ({
  heartbeatService: () => ({
    wakeup: mockWakeup,
  }),
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

function createHandlers() {
  const services = buildHostServices(
    {} as never,
    "plugin-record-id",
    "paperclip-plugin-telegram",
    createEventBusStub(),
  );
  return createHostClientHandlers({
    pluginId: "paperclip-plugin-telegram",
    capabilities: ["issue.comments.create"],
    services,
  });
}

describe("plugin issue comment wakeups", () => {
  beforeEach(() => {
    mockGetById.mockReset();
    mockAddComment.mockReset();
    mockFindMentionedAgents.mockReset();
    mockWakeup.mockReset();
    mockFindMentionedAgents.mockResolvedValue([]);
    mockWakeup.mockResolvedValue({ id: "run-1" });
  });

  it("wakes the assignee when a plugin creates a comment on an open issue", async () => {
    mockGetById.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
      assigneeAgentId: "agent-1",
      status: "blocked",
    });
    mockAddComment.mockResolvedValue({
      id: "comment-1",
      companyId: "company-1",
      issueId: "issue-1",
      body: "owner reply",
    });

    const handlers = createHandlers();

    await handlers["issues.createComment"]({
      companyId: "company-1",
      issueId: "issue-1",
      body: "owner reply",
    });

    await vi.waitFor(() => {
      expect(mockWakeup).toHaveBeenCalledWith("agent-1", expect.objectContaining({
        source: "automation",
        triggerDetail: "system",
        reason: "issue_commented",
        payload: expect.objectContaining({
          issueId: "issue-1",
          commentId: "comment-1",
          mutation: "comment",
        }),
        requestedByActorType: "system",
        requestedByActorId: "plugin-record-id",
        contextSnapshot: expect.objectContaining({
          issueId: "issue-1",
          taskId: "issue-1",
          commentId: "comment-1",
          source: "issue.comment",
          wakeReason: "issue_commented",
        }),
      }));
    });
  });

  it("does not wake the assignee for plugin comments on terminal issues", async () => {
    mockGetById.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
      assigneeAgentId: "agent-1",
      status: "done",
    });
    mockAddComment.mockResolvedValue({
      id: "comment-1",
      companyId: "company-1",
      issueId: "issue-1",
      body: "late reply",
    });

    const handlers = createHandlers();

    await handlers["issues.createComment"]({
      companyId: "company-1",
      issueId: "issue-1",
      body: "late reply",
    });

    await vi.waitFor(() => {
      expect(mockFindMentionedAgents).toHaveBeenCalled();
    });
    expect(mockWakeup).not.toHaveBeenCalled();
  });
});
