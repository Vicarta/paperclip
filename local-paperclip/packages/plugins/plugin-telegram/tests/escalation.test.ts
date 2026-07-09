import { describe, it, expect, vi, beforeEach } from "vitest";
import { EscalationManager } from "../src/escalation.js";
import type { EscalationEvent } from "../src/escalation.js";
import type { PluginContext } from "@paperclipai/plugin-sdk";

let sentMessages: Array<{ chatId: string; text: string; options?: Record<string, unknown> }> = [];
let editedMessages: Array<{ chatId: string; messageId: number; text: string; options?: Record<string, unknown> }> = [];
let stateStore: Record<string, unknown> = {};
let emittedEvents: Array<{ event: string; companyId: string; payload: unknown }> = [];
let createdIssueComments: Array<{ issueId: string; body: string; companyId: string }> = [];
let listedIssues: Array<{ id: string; identifier: string | null }> = [];
let wakeAgentCalls: Array<unknown[]> = [];

vi.mock("../src/telegram-api.js", async () => {
  const actual = await vi.importActual("../src/telegram-api.js") as Record<string, unknown>;
  return {
    ...actual,
    sendMessage: vi.fn(async (_ctx: unknown, _token: string, chatId: string, text: string, options?: Record<string, unknown>) => {
      sentMessages.push({ chatId, text, options });
      return 41 + sentMessages.length;
    }),
    editMessage: vi.fn(async (_ctx: unknown, _token: string, chatId: string, messageId: number, text: string, options?: Record<string, unknown>) => {
      editedMessages.push({ chatId, messageId, text, options });
      return true;
    }),
  };
});

vi.mock("../src/acp-bridge.js", () => ({
  wakeAgentWithIssue: vi.fn(async (...args: unknown[]) => {
    wakeAgentCalls.push(args);
    return "fallback-issue-id";
  }),
}));

function mockCtx(): PluginContext {
  return {
    http: { fetch: vi.fn() },
    metrics: { write: vi.fn() },
    state: {
      get: vi.fn(async (key: { stateKey: string }) => stateStore[key.stateKey] ?? null),
      set: vi.fn(async (key: { stateKey: string }, value: unknown) => {
        stateStore[key.stateKey] = value;
      }),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    events: {
      emit: vi.fn((event: string, companyId: string, payload: unknown) => {
        emittedEvents.push({ event, companyId, payload });
      }),
    },
    agents: {
      sessions: {
        sendMessage: vi.fn(),
        close: vi.fn(),
      },
    },
    issues: {
      list: vi.fn(async () => listedIssues),
      createComment: vi.fn(async (issueId: string, body: string, companyId: string) => {
        createdIssueComments.push({ issueId, body, companyId });
        return { id: "comment-1", issueId, body, companyId };
      }),
    },
  } as unknown as PluginContext;
}

function makeEvent(overrides: Partial<EscalationEvent> = {}): EscalationEvent {
  return {
    escalationId: "esc-001",
    agentId: "agent-1",
    companyId: "company-1",
    reason: "low_confidence",
    context: {
      conversationHistory: [{ role: "user", text: "Help me" }],
      agentReasoning: "I'm not sure about this",
      suggestedActions: ["Forward to support"],
      suggestedReply: "Let me connect you with a human.",
      confidenceScore: 0.3,
    },
    timeout: {
      durationMs: 60000,
      defaultAction: "defer",
    },
    originChatId: "origin-chat-1",
    originThreadId: "origin-thread-1",
    originMessageId: "origin-msg-1",
    transport: "native",
    sessionId: "session-1",
    ...overrides,
  };
}

beforeEach(() => {
  sentMessages = [];
  editedMessages = [];
  stateStore = {};
  emittedEvents = [];
  createdIssueComments = [];
  listedIssues = [];
  wakeAgentCalls = [];
});

describe("EscalationManager.create", () => {
  it("sends an escalation message with MarkdownV2 formatting", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent(), "esc-chat-1");

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].chatId).toBe("esc-chat-1");
    expect(sentMessages[0].text).toContain("Escalation");
    expect(sentMessages[0].text).toContain("Low Confidence");
    expect(sentMessages[0].options).toMatchObject({ parseMode: "MarkdownV2" });
  });

  it("formats owner decision escalations in human-facing Ukrainian", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent({
      reason: "explicit_request",
      context: {
        conversationHistory: [],
        agentReasoning: "Потрібне рішення щодо AST-1436: що робити зі статтею, якщо поточний запит змішує знак зодіаку і калькулятор?",
        suggestedActions: [
          "Залишити поточну тему.",
          "Уточнити тему без нового планування.",
        ],
        suggestedReply: "2",
        confidenceScore: 1,
      },
    }), "esc-chat-1");

    expect(sentMessages[0].text).toContain("Потрібна ваша увага");
    expect(sentMessages[0].text).toContain("Ситуація");
    expect(sentMessages[0].text).toContain("Варіанти");
    expect(sentMessages[0].text).toContain("Рекомендована відповідь");
    expect(sentMessages[0].text).not.toContain("Agent:");
    expect(sentMessages[0].text).not.toContain("Suggested actions");
    expect(sentMessages[0].options.inlineKeyboard?.[0]?.[0]?.text).toBe("Надіслати рекомендовану відповідь");
    expect(sentMessages[0].options.inlineKeyboard?.[1]?.[0]?.text).toBe("Відповісти");
  });

  it("includes confidence score percentage", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent({ context: {
      conversationHistory: [],
      agentReasoning: "test",
      suggestedActions: [],
      confidenceScore: 0.72,
    }}), "esc-chat-1");

    expect(sentMessages[0].text).toContain("72%");
  });

  it("omits confidence when not provided", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent({ context: {
      conversationHistory: [],
      agentReasoning: "test",
      suggestedActions: [],
      confidenceScore: undefined,
    }}), "esc-chat-1");

    expect(sentMessages[0].text).not.toContain("%");
  });

  it("includes suggested reply button when suggestedReply is provided", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent(), "esc-chat-1");

    const keyboard = sentMessages[0].options?.inlineKeyboard as Array<Array<{ text: string; callback_data: string }>>;
    expect(keyboard).toBeDefined();
    // First row should be the suggested reply button
    const suggestedBtn = keyboard[0].find((b: { text: string }) => b.text === "Send Suggested Reply");
    expect(suggestedBtn).toBeDefined();
    expect(suggestedBtn!.callback_data).toBe("esc_suggested_esc-001");
  });

  it("omits suggested reply button when no suggestedReply", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent({ context: {
      conversationHistory: [],
      agentReasoning: "test",
      suggestedActions: [],
      suggestedReply: undefined,
    }}), "esc-chat-1");

    const keyboard = sentMessages[0].options?.inlineKeyboard as Array<Array<{ text: string; callback_data: string }>>;
    const allButtons = keyboard.flat();
    expect(allButtons.find((b: { text: string }) => b.text === "Send Suggested Reply")).toBeUndefined();
  });

  it("always includes Reply, Override, and Dismiss buttons", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent(), "esc-chat-1");

    const keyboard = sentMessages[0].options?.inlineKeyboard as Array<Array<{ text: string; callback_data: string }>>;
    const allButtons = keyboard.flat();
    expect(allButtons.find((b: { text: string }) => b.text === "Reply")).toBeDefined();
    expect(allButtons.find((b: { text: string }) => b.text === "Override")).toBeDefined();
    expect(allButtons.find((b: { text: string }) => b.text === "Dismiss")).toBeDefined();
  });

  it("stores escalation state in ctx.state", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent(), "esc-chat-1");

    const stored = stateStore["escalation_esc-001"] as Record<string, unknown>;
    expect(stored).toBeDefined();
    expect(stored.escalationId).toBe("esc-001");
    expect(stored.status).toBe("pending");
    expect(stored.agentId).toBe("agent-1");
    expect(stored.reason).toBe("low_confidence");
  });

  it("adds escalation id to pending list", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent(), "esc-chat-1");

    const pendingIds = stateStore["escalation_pending_ids"] as string[];
    expect(pendingIds).toContain("esc-001");
  });

  it("appends to existing pending list", async () => {
    stateStore["escalation_pending_ids"] = ["esc-000"];
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent(), "esc-chat-1");

    const pendingIds = stateStore["escalation_pending_ids"] as string[];
    expect(pendingIds).toEqual(["esc-000", "esc-001"]);
  });

  it("supersedes older pending escalation for the same source issue", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    await manager.create(ctx, "token", makeEvent({
      escalationId: "esc-old",
      context: {
        conversationHistory: [],
        agentReasoning: "[AST-926] old decision prompt",
        suggestedActions: [],
      },
    }), "esc-chat-1");

    await manager.create(ctx, "token", makeEvent({
      escalationId: "esc-new",
      context: {
        conversationHistory: [],
        agentReasoning: "[AST-926] corrected decision prompt",
        suggestedActions: [],
      },
    }), "esc-chat-1");

    const oldStored = stateStore["escalation_esc-old"] as Record<string, unknown>;
    const newStored = stateStore["escalation_esc-new"] as Record<string, unknown>;
    const pendingIds = stateStore["escalation_pending_ids"] as string[];
    const oldMapping = stateStore["msg_esc-chat-1_42"] as Record<string, unknown>;

    expect(oldStored.status).toBe("superseded");
    expect(oldStored.supersededByEscalationId).toBe("esc-new");
    expect(newStored.status).toBe("pending");
    expect(pendingIds).toEqual(["esc-new"]);
    expect(oldMapping.entityType).toBe("superseded_escalation");
    expect(editedMessages.some((message) => message.text.includes("Superseded"))).toBe(true);
  });

  it("includes suggested actions in message", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent({ context: {
      conversationHistory: [],
      agentReasoning: "test",
      suggestedActions: ["Action 1", "Action 2"],
    }}), "esc-chat-1");

    expect(sentMessages[0].text).toContain("Action 1");
    expect(sentMessages[0].text).toContain("Action 2");
  });

  it("maps all four escalation reasons to labels", async () => {
    const manager = new EscalationManager();

    for (const [reason, label] of [
      ["low_confidence", "Low Confidence"],
      ["explicit_request", "User Requested Human"],
      ["policy_violation", "Policy Violation"],
      ["unknown_intent", "Unknown Intent"],
    ] as const) {
      sentMessages = [];
      const ctx = mockCtx();
      await manager.create(ctx, "token", makeEvent({ reason }), "chat");
      expect(sentMessages[0].text).toContain(label.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&"));
    }
  });

  it("stores transport and sessionId in escalation state", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    await manager.create(ctx, "token", makeEvent({ transport: "acp", sessionId: "sess-acp" }), "esc-chat-1");

    const stored = stateStore["escalation_esc-001"] as Record<string, unknown>;
    expect(stored.transport).toBe("acp");
    expect(stored.sessionId).toBe("sess-acp");
  });
});

describe("EscalationManager.handleCallback - callback data parsing", () => {
  it("handles esc_suggested action with suggested reply", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "unsure",
      suggestedReply: "Here is help",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 60000).toISOString(),
      defaultAction: "defer",
    };

    await manager.handleCallback(ctx, "token", "suggested", "esc-001", "user-1", "cbq-1", "esc-chat-1", 42);

    // Should resolve and edit message
    const stored = stateStore["escalation_esc-001"] as Record<string, unknown>;
    expect(stored.status).toBe("resolved");
  });

  it("handles esc_reply action by editing message to awaiting reply", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "unsure",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 60000).toISOString(),
      defaultAction: "defer",
    };

    await manager.handleCallback(ctx, "token", "reply", "esc-001", "user-1", "cbq-1", "esc-chat-1", 42);

    expect(editedMessages.length).toBe(1);
    expect(editedMessages[0].text).toContain("Awaiting your reply");
  });

  it("handles esc_dismiss action", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "test",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 60000).toISOString(),
      defaultAction: "defer",
    };

    await manager.handleCallback(ctx, "token", "dismiss", "esc-001", "user-1", "cbq-1", "esc-chat-1", 42);

    const stored = stateStore["escalation_esc-001"] as Record<string, unknown>;
    expect(stored.status).toBe("resolved");
  });

  it("ignores callback for non-pending escalation", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      status: "resolved",
    };

    await manager.handleCallback(ctx, "token", "dismiss", "esc-001", "user-1", "cbq-1", "esc-chat-1", 42);

    // Nothing should happen
    expect(editedMessages.length).toBe(0);
    expect(emittedEvents.length).toBe(0);
  });

  it("ignores callback for non-existent escalation", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    await manager.handleCallback(ctx, "token", "dismiss", "nonexistent", "user-1", "cbq-1", "chat", 42);

    expect(editedMessages.length).toBe(0);
  });
});

describe("EscalationManager.checkTimeouts", () => {
  it("times out escalation that has exceeded timeout", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_pending_ids"] = ["esc-001"];
    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "test",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date(Date.now() - 120000).toISOString(),
      timeoutAt: new Date(Date.now() - 60000).toISOString(), // already timed out
      defaultAction: "defer",
    };

    await manager.checkTimeouts(ctx, "token");

    const stored = stateStore["escalation_esc-001"] as Record<string, unknown>;
    expect(stored.status).toBe("timed_out");
    expect(editedMessages.length).toBe(1);
    expect(editedMessages[0].text).toContain("Timed Out");
  });

  it("does not time out escalation that has not exceeded timeout", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_pending_ids"] = ["esc-001"];
    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "test",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 60000).toISOString(), // future
      defaultAction: "defer",
    };

    await manager.checkTimeouts(ctx, "token");

    const stored = stateStore["escalation_esc-001"] as Record<string, unknown>;
    expect(stored.status).toBe("pending");
    expect(editedMessages.length).toBe(0);
  });

  it("auto-replies on timeout when defaultAction is auto_reply", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_pending_ids"] = ["esc-001"];
    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "test",
      suggestedReply: "Auto response text",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date(Date.now() - 120000).toISOString(),
      timeoutAt: new Date(Date.now() - 60000).toISOString(),
      defaultAction: "auto_reply",
      originChatId: "origin-chat",
    };

    await manager.checkTimeouts(ctx, "token");

    // Should have sent auto-reply to origin chat
    expect(sentMessages.some(m => m.chatId === "origin-chat")).toBe(true);
  });

  it("removes timed-out escalation from pending list", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_pending_ids"] = ["esc-001", "esc-002"];
    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "test",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date(Date.now() - 120000).toISOString(),
      timeoutAt: new Date(Date.now() - 60000).toISOString(),
      defaultAction: "defer",
    };
    stateStore["escalation_esc-002"] = {
      escalationId: "esc-002",
      status: "pending",
      timeoutAt: new Date(Date.now() + 60000).toISOString(),
      escalationChatId: "chat",
      escalationMessageId: "99",
      agentId: "a",
      companyId: "c",
      reason: "low_confidence",
      agentReasoning: "x",
      suggestedActions: [],
      createdAt: new Date().toISOString(),
      defaultAction: "defer",
    };

    await manager.checkTimeouts(ctx, "token");

    const pendingIds = stateStore["escalation_pending_ids"] as string[];
    expect(pendingIds).not.toContain("esc-001");
    expect(pendingIds).toContain("esc-002");
  });

  it("does nothing when pending list is empty", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    await manager.checkTimeouts(ctx, "token");

    expect(editedMessages.length).toBe(0);
    expect(sentMessages.length).toBe(0);
  });

  it("emits escalation.timed_out event", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_pending_ids"] = ["esc-001"];
    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "test",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date(Date.now() - 120000).toISOString(),
      timeoutAt: new Date(Date.now() - 60000).toISOString(),
      defaultAction: "defer",
    };

    await manager.checkTimeouts(ctx, "token");

    expect(emittedEvents.some(e => e.event === "escalation.timed_out")).toBe(true);
  });
});

describe("EscalationManager.respond", () => {
  it("resolves a pending escalation", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "low_confidence",
      agentReasoning: "test",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 60000).toISOString(),
      defaultAction: "defer",
    };
    stateStore["escalation_pending_ids"] = ["esc-001"];

    await manager.respond(ctx, "token", "esc-001", {
      escalationId: "esc-001",
      responderId: "user-1",
      responseText: "Here is the answer",
      action: "reply_to_customer",
    });

    const stored = stateStore["escalation_esc-001"] as Record<string, unknown>;
    expect(stored.status).toBe("resolved");
  });

  it("writes native replies back to the source issue before resolving", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    listedIssues = [{ id: "issue-ast-926", identifier: "AST-926" }];

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "explicit_request",
      sourceIssueIdentifier: "AST-926",
      agentReasoning: "[AST-926] decision",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 60000).toISOString(),
      defaultAction: "defer",
      transport: "native",
    };
    stateStore["escalation_pending_ids"] = ["esc-001"];

    await manager.respond(ctx, "token", "esc-001", {
      escalationId: "esc-001",
      responderId: "telegram:owner",
      responseText: "1,2",
      action: "reply_to_customer",
    });

    expect(createdIssueComments).toHaveLength(1);
    expect(createdIssueComments[0]).toMatchObject({
      issueId: "issue-ast-926",
      companyId: "company-1",
    });
    expect(createdIssueComments[0].body).toContain("1,2");
    expect(wakeAgentCalls).toHaveLength(0);
    expect((stateStore["escalation_esc-001"] as Record<string, unknown>).status).toBe("resolved");
  });

  it("keeps escalation pending when source issue writeback fails", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();
    listedIssues = [{ id: "issue-ast-926", identifier: "AST-926" }];
    (ctx.issues.createComment as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("write failed"));

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      agentId: "agent-1",
      companyId: "company-1",
      reason: "explicit_request",
      sourceIssueIdentifier: "AST-926",
      agentReasoning: "[AST-926] decision",
      suggestedActions: [],
      escalationChatId: "esc-chat-1",
      escalationMessageId: "42",
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 60000).toISOString(),
      defaultAction: "defer",
      transport: "native",
    };
    stateStore["escalation_pending_ids"] = ["esc-001"];

    await manager.respond(ctx, "token", "esc-001", {
      escalationId: "esc-001",
      responderId: "telegram:owner",
      responseText: "1,2",
      action: "reply_to_customer",
    });

    expect((stateStore["escalation_esc-001"] as Record<string, unknown>).status).toBe("pending");
    expect(editedMessages).toHaveLength(0);
  });

  it("ignores respond for non-pending escalation", async () => {
    const manager = new EscalationManager();
    const ctx = mockCtx();

    stateStore["escalation_esc-001"] = {
      escalationId: "esc-001",
      status: "resolved",
    };

    await manager.respond(ctx, "token", "esc-001", {
      escalationId: "esc-001",
      responderId: "user-1",
      responseText: "text",
      action: "reply_to_customer",
    });

    expect(editedMessages.length).toBe(0);
  });
});
