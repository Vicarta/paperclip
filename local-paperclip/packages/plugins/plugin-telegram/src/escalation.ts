import type { PluginContext } from "@paperclipai/plugin-sdk";
import { sendMessage, editMessage, escapeMarkdownV2, truncateAtWord } from "./telegram-api.js";
import { wakeAgentWithIssue } from "./acp-bridge.js";

export type EscalationReason =
  | "low_confidence"
  | "explicit_request"
  | "policy_violation"
  | "unknown_intent";

export type EscalationEvent = {
  escalationId: string;
  agentId: string;
  companyId: string;
  reason: EscalationReason;
  context: {
    conversationHistory: Array<{ role: string; text: string }>;
    agentReasoning: string;
    suggestedActions: string[];
    suggestedReply?: string;
    confidenceScore?: number;
  };
  timeout: {
    durationMs: number;
    defaultAction: "defer" | "auto_reply" | "close";
  };
  originChatId?: string;
  originThreadId?: string;
  originMessageId?: string;
  // Transport info for routing replies back
  transport?: "native" | "acp";
  sessionId?: string;
};

export type EscalationResponse = {
  escalationId: string;
  responderId: string;
  responseText: string;
  action: "reply_to_customer" | "override_suggested" | "dismiss";
};

type StoredEscalation = {
  escalationId: string;
  agentId: string;
  companyId: string;
  reason: EscalationReason;
  sourceIssueIdentifier?: string;
  agentReasoning: string;
  suggestedReply?: string;
  suggestedActions: string[];
  confidenceScore?: number;
  originChatId?: string;
  originThreadId?: string;
  originMessageId?: string;
  escalationChatId: string;
  escalationMessageId: string;
  status: "pending" | "resolved" | "timed_out" | "superseded";
  supersededByEscalationId?: string;
  createdAt: string;
  timeoutAt: string;
  defaultAction: "defer" | "auto_reply" | "close";
  transport?: "native" | "acp";
  sessionId?: string;
};

const REASON_LABELS: Record<EscalationReason, string> = {
  low_confidence: "Low Confidence",
  explicit_request: "User Requested Human",
  policy_violation: "Policy Violation",
  unknown_intent: "Unknown Intent",
};

function esc(s: string): string {
  return escapeMarkdownV2(s);
}

function extractIssueIdentifier(text: string): string | undefined {
  return text.match(/\b[A-Z][A-Z0-9]{1,12}-\d+\b/)?.[0];
}

export class EscalationManager {
  async create(
    ctx: PluginContext,
    token: string,
    event: EscalationEvent,
    escalationChatId: string,
  ): Promise<void> {
    const reasonLabel = REASON_LABELS[event.reason] ?? event.reason;
    const confidence = event.context.confidenceScore != null
      ? ` \\(${esc(String(Math.round(event.context.confidenceScore * 100)))}%\\)`
      : "";

    const lines: string[] = [
      `${esc("\u26a0\ufe0f")} *Escalation* \\- ${esc(reasonLabel)}${confidence}`,
      "",
      `*Agent:* ${esc(event.agentId)}`,
      `*Reason:* ${esc(event.context.agentReasoning ? truncateAtWord(event.context.agentReasoning, 500) : "No details provided")}`,
    ];

    if (event.context.suggestedActions.length > 0) {
      lines.push("");
      lines.push("*Suggested actions:*");
      for (const action of event.context.suggestedActions.slice(0, 5)) {
        lines.push(`  ${esc("-")} ${esc(action)}`);
      }
    }

    if (event.context.suggestedReply) {
      lines.push("");
      lines.push("*Suggested reply:*");
      lines.push(`${esc(">")} ${esc(truncateAtWord(event.context.suggestedReply, 300))}`);
    }

    lines.push("");
    lines.push(`ID: \`${esc(event.escalationId)}\``);

    const buttons = [];
    if (event.context.suggestedReply) {
      buttons.push([
        { text: "Send Suggested Reply", callback_data: `esc_suggested_${event.escalationId}` },
      ]);
    }
    buttons.push([
      { text: "Reply", callback_data: `esc_reply_${event.escalationId}` },
      { text: "Override", callback_data: `esc_override_${event.escalationId}` },
      { text: "Dismiss", callback_data: `esc_dismiss_${event.escalationId}` },
    ]);

    const messageId = await sendMessage(ctx, token, escalationChatId, lines.join("\n"), {
      parseMode: "MarkdownV2",
      inlineKeyboard: buttons,
    });

    if (!messageId) {
      ctx.logger.error("Failed to send escalation message", { escalationId: event.escalationId });
      return;
    }

    const timeoutAt = new Date(Date.now() + event.timeout.durationMs).toISOString();
    const sourceIssueIdentifier = extractIssueIdentifier(event.context.agentReasoning ?? "");

    const stored: StoredEscalation = {
      escalationId: event.escalationId,
      agentId: event.agentId,
      companyId: event.companyId,
      reason: event.reason,
      sourceIssueIdentifier,
      agentReasoning: event.context.agentReasoning,
      suggestedReply: event.context.suggestedReply,
      suggestedActions: event.context.suggestedActions,
      confidenceScore: event.context.confidenceScore,
      originChatId: event.originChatId,
      originThreadId: event.originThreadId,
      originMessageId: event.originMessageId,
      escalationChatId,
      escalationMessageId: String(messageId),
      status: "pending",
      createdAt: new Date().toISOString(),
      timeoutAt,
      defaultAction: event.timeout.defaultAction,
      transport: event.transport,
      sessionId: event.sessionId,
    };

    await ctx.state.set(
      { scopeKind: "instance", stateKey: `escalation_${event.escalationId}` },
      stored,
    );

    // Map the escalation message back so replies can be routed
    await ctx.state.set(
      { scopeKind: "instance", stateKey: `msg_${escalationChatId}_${messageId}` },
      {
        entityId: event.escalationId,
        entityType: "escalation",
        companyId: event.companyId,
        eventType: "escalation.created",
      },
    );

    // Track pending escalation IDs for timeout checks
    const pendingIds = (await ctx.state.get({
      scopeKind: "instance",
      stateKey: "escalation_pending_ids",
    }) as string[] | null) ?? [];
    const nextPendingIds = Array.from(new Set([...pendingIds, event.escalationId]));
    await ctx.state.set(
      { scopeKind: "instance", stateKey: "escalation_pending_ids" },
      nextPendingIds,
    );

    await this.supersedePreviousPending(ctx, token, stored);

    ctx.logger.info("Escalation created", {
      escalationId: event.escalationId,
      reason: event.reason,
      sourceIssueIdentifier,
      timeoutAt,
    });
  }

  async handleCallback(
    ctx: PluginContext,
    token: string,
    action: string,
    escalationId: string,
    actor: string,
    callbackQueryId: string,
    chatId: string | null,
    messageId: number | undefined,
  ): Promise<void> {
    const stored = await ctx.state.get({
      scopeKind: "instance",
      stateKey: `escalation_${escalationId}`,
    }) as StoredEscalation | null;

    if (!stored || stored.status !== "pending") {
      return;
    }

    switch (action) {
      case "suggested": {
        if (!stored.suggestedReply) break;
        await this.resolve(ctx, token, stored, {
          escalationId,
          responderId: `telegram:${actor}`,
          responseText: stored.suggestedReply,
          action: "reply_to_customer",
        });
        break;
      }
      case "reply": {
        if (chatId && messageId) {
          await editMessage(
            ctx,
            token,
            chatId,
            messageId,
            `${esc("\u26a0\ufe0f")} *Escalation* \\- *Awaiting your reply*\n\n${esc("Reply to this message with your response to the customer.")}`,
            { parseMode: "MarkdownV2" },
          );
        }
        break;
      }
      case "dismiss": {
        await this.resolve(ctx, token, stored, {
          escalationId,
          responderId: `telegram:${actor}`,
          responseText: "",
          action: "dismiss",
        });
        break;
      }
      case "override": {
        if (chatId && messageId) {
          await editMessage(
            ctx,
            token,
            chatId,
            messageId,
            `${esc("\u26a0\ufe0f")} *Escalation* \\- *Override mode*\n\n${esc("Reply to this message with your custom response.")}`,
            { parseMode: "MarkdownV2" },
          );
        }
        break;
      }
    }
  }

  async respond(
    ctx: PluginContext,
    token: string,
    escalationId: string,
    response: EscalationResponse,
  ): Promise<void> {
    const stored = await ctx.state.get({
      scopeKind: "instance",
      stateKey: `escalation_${escalationId}`,
    }) as StoredEscalation | null;

    if (!stored || stored.status !== "pending") {
      ctx.logger.warn("Escalation respond called for non-pending escalation", { escalationId });
      return;
    }

    await this.resolve(ctx, token, stored, response);
  }

  private async resolve(
    ctx: PluginContext,
    token: string,
    stored: StoredEscalation,
    response: EscalationResponse,
  ): Promise<void> {
    if (response.action === "reply_to_customer" && response.responseText) {
      const routed = await this.routeReply(ctx, stored, response);
      if (!routed) {
        ctx.logger.error("Escalation reply writeback failed; keeping escalation pending", {
          escalationId: stored.escalationId,
          sourceIssueIdentifier: stored.sourceIssueIdentifier,
          transport: stored.transport,
        });
        return;
      }
    }

    stored.status = "resolved";
    await ctx.state.set(
      { scopeKind: "instance", stateKey: `escalation_${stored.escalationId}` },
      stored,
    );

    await this.removePending(ctx, stored.escalationId);

    const statusLabel = response.action === "dismiss" ? "Dismissed" : "Resolved";
    await editMessage(
      ctx,
      token,
      stored.escalationChatId,
      Number(stored.escalationMessageId),
      `${esc("\u2705")} *Escalation ${statusLabel}* by ${esc(response.responderId)}\n\nID: \`${esc(stored.escalationId)}\``,
      { parseMode: "MarkdownV2" },
    );

    // Emit resolution event - companyId is SECOND arg
    ctx.events.emit("escalation.resolved", stored.companyId, {
      escalationId: stored.escalationId,
      agentId: stored.agentId,
      responderId: response.responderId,
      responseText: response.responseText,
      action: response.action,
    });

    ctx.logger.info("Escalation resolved", {
      escalationId: stored.escalationId,
      action: response.action,
      responderId: response.responderId,
    });
  }

  private async supersedePreviousPending(
    ctx: PluginContext,
    token: string,
    current: StoredEscalation,
  ): Promise<void> {
    const currentSourceIssueIdentifier =
      current.sourceIssueIdentifier ?? extractIssueIdentifier(current.agentReasoning ?? "");
    if (!currentSourceIssueIdentifier) return;

    const pendingIds = (await ctx.state.get({
      scopeKind: "instance",
      stateKey: "escalation_pending_ids",
    }) as string[] | null) ?? [];

    const remaining = new Set(pendingIds);
    for (const escalationId of pendingIds) {
      if (escalationId === current.escalationId) continue;

      const previous = await ctx.state.get({
        scopeKind: "instance",
        stateKey: `escalation_${escalationId}`,
      }) as StoredEscalation | null;

      if (!previous || previous.status !== "pending") {
        remaining.delete(escalationId);
        continue;
      }

      const previousSourceIssueIdentifier =
        previous.sourceIssueIdentifier ?? extractIssueIdentifier(previous.agentReasoning ?? "");
      const sameSource =
        previous.companyId === current.companyId &&
        previous.agentId === current.agentId &&
        previous.reason === current.reason &&
        previousSourceIssueIdentifier === currentSourceIssueIdentifier;
      if (!sameSource) continue;

      previous.status = "superseded";
      previous.supersededByEscalationId = current.escalationId;
      await ctx.state.set(
        { scopeKind: "instance", stateKey: `escalation_${previous.escalationId}` },
        previous,
      );
      remaining.delete(previous.escalationId);

      await ctx.state.set(
        { scopeKind: "instance", stateKey: `msg_${previous.escalationChatId}_${previous.escalationMessageId}` },
        {
          entityId: previous.escalationId,
          entityType: "superseded_escalation",
          companyId: previous.companyId,
          replacementEscalationId: current.escalationId,
        },
      );

      try {
        await editMessage(
          ctx,
          token,
          previous.escalationChatId,
          Number(previous.escalationMessageId),
          `${esc("⚠️")} *Escalation Superseded*\n\n${esc("This request was replaced by a newer message. Please reply to the latest Telegram prompt.")}\n\nID: \`${esc(previous.escalationId)}\`\nNew ID: \`${esc(current.escalationId)}\``,
          { parseMode: "MarkdownV2" },
        );
      } catch (error) {
        ctx.logger.warn("Failed to edit superseded Telegram escalation message", {
          escalationId: previous.escalationId,
          replacementEscalationId: current.escalationId,
          error: String(error),
        });
      }
    }

    await ctx.state.set(
      { scopeKind: "instance", stateKey: "escalation_pending_ids" },
      Array.from(remaining),
    );
  }

  private async routeReply(
    ctx: PluginContext,
    stored: StoredEscalation,
    response: EscalationResponse,
  ): Promise<boolean> {
    if (stored.transport === "acp" && stored.sessionId) {
      ctx.events.emit("acp-spawn", stored.companyId, {
        type: "message",
        sessionId: stored.sessionId,
        text: `[Human escalation response] ${response.responseText}`,
      });
      return true;
    }

    const sourceIssueIdentifier =
      stored.sourceIssueIdentifier ?? extractIssueIdentifier(stored.agentReasoning ?? "");

    if (sourceIssueIdentifier) {
      const sourceIssue = await this.findIssueByIdentifier(ctx, stored.companyId, sourceIssueIdentifier);
      if (sourceIssue) {
        try {
          await ctx.issues.createComment(
            sourceIssue.id,
            [
              "## Telegram owner reply",
              "",
              `Escalation: \`${stored.escalationId}\``,
              `Responder: \`${response.responderId}\``,
              "",
              response.responseText,
            ].join("\n"),
            stored.companyId,
          );
          return true;
        } catch (error) {
          ctx.logger.error("Failed to write Telegram escalation reply to source issue", {
            escalationId: stored.escalationId,
            sourceIssueIdentifier,
            error: String(error),
          });
          return false;
        }
      }
    }

    if (stored.transport === "native" && stored.agentId) {
      const issueId = await wakeAgentWithIssue(
        ctx,
        stored.agentId,
        stored.companyId,
        `[Human escalation response] ${response.responseText}`,
        "escalation_reply",
      );
      return Boolean(issueId);
    }

    return true;
  }

  private async findIssueByIdentifier(
    ctx: PluginContext,
    companyId: string,
    identifier: string,
  ): Promise<{ id: string } | null> {
    const pageSize = 100;
    for (let offset = 0; offset < 500; offset += pageSize) {
      const issues = await ctx.issues.list({ companyId, limit: pageSize, offset });
      const match = issues.find((issue) => issue.identifier === identifier);
      if (match) return { id: match.id };
      if (issues.length < pageSize) break;
    }
    return null;
  }

  async checkTimeouts(ctx: PluginContext, token: string): Promise<void> {
    const pendingIds = (await ctx.state.get({
      scopeKind: "instance",
      stateKey: "escalation_pending_ids",
    }) as string[] | null) ?? [];

    if (pendingIds.length === 0) return;

    const now = Date.now();

    for (const escalationId of pendingIds) {
      const stored = await ctx.state.get({
        scopeKind: "instance",
        stateKey: `escalation_${escalationId}`,
      }) as StoredEscalation | null;

      if (!stored || stored.status !== "pending") {
        await this.removePending(ctx, escalationId);
        continue;
      }

      const timeoutAt = new Date(stored.timeoutAt).getTime();
      if (now < timeoutAt) continue;

      ctx.logger.info("Escalation timed out", { escalationId, defaultAction: stored.defaultAction });

      stored.status = "timed_out";
      await ctx.state.set(
        { scopeKind: "instance", stateKey: `escalation_${escalationId}` },
        stored,
      );

      await this.removePending(ctx, escalationId);

      await editMessage(
        ctx,
        token,
        stored.escalationChatId,
        Number(stored.escalationMessageId),
        `${esc("\u23f0")} *Escalation Timed Out*\n\nDefault action: ${esc(stored.defaultAction)}\nID: \`${esc(escalationId)}\``,
        { parseMode: "MarkdownV2" },
      );

      // Emit timeout event - companyId is SECOND arg
      ctx.events.emit("escalation.timed_out", stored.companyId, {
        escalationId,
        agentId: stored.agentId,
        defaultAction: stored.defaultAction,
        suggestedReply: stored.suggestedReply,
      });

      if (stored.defaultAction === "auto_reply" && stored.suggestedReply && stored.originChatId) {
        await sendMessage(ctx, token, stored.originChatId, esc(stored.suggestedReply), {
          parseMode: "MarkdownV2",
          messageThreadId: stored.originThreadId ? Number(stored.originThreadId) : undefined,
          replyToMessageId: stored.originMessageId ? Number(stored.originMessageId) : undefined,
        });
      }
    }
  }

  private async removePending(ctx: PluginContext, escalationId: string): Promise<void> {
    const pendingIds = (await ctx.state.get({
      scopeKind: "instance",
      stateKey: "escalation_pending_ids",
    }) as string[] | null) ?? [];

    const updated = pendingIds.filter((id) => id !== escalationId);
    await ctx.state.set(
      { scopeKind: "instance", stateKey: "escalation_pending_ids" },
      updated,
    );
  }
}
