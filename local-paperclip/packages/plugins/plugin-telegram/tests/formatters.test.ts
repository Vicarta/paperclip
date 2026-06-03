import { describe, it, expect } from "vitest";
import {
  formatIssueCreated,
  formatIssueDone,
  formatIssueAssigned,
  formatApprovalCreated,
  formatAgentError,
  formatAgentRunStarted,
  formatAgentRunFinished,
} from "../src/formatters.js";
import type { PluginEvent } from "@paperclipai/plugin-sdk";

function mockEvent(overrides: Record<string, unknown> = {}): PluginEvent {
  return {
    eventType: "issue.created",
    entityId: "iss-123",
    entityType: "issue",
    companyId: "co-1",
    occurredAt: new Date().toISOString(),
    payload: { identifier: "PROJ-42", title: "Test issue", ...overrides },
  } as PluginEvent;
}

describe("formatIssueCreated", () => {
  it("includes identifier and title", () => {
    const msg = formatIssueCreated(mockEvent());
    expect(msg.text).toContain("PROJ\\-42");
    expect(msg.text).toContain("Test issue");
  });

  it("falls back to entityId when no identifier", () => {
    const msg = formatIssueCreated(mockEvent({ identifier: undefined }));
    expect(msg.text).toContain("iss\\-123");
  });

  it("uses MarkdownV2 parse mode", () => {
    const msg = formatIssueCreated(mockEvent());
    expect(msg.options.parseMode).toBe("MarkdownV2");
  });

  it("includes metadata fields when available", () => {
    const msg = formatIssueCreated(mockEvent({
      status: "open",
      priority: "high",
      assigneeName: "Alice",
      projectName: "Backend",
    }));
    expect(msg.text).toContain("open");
    expect(msg.text).toContain("high");
    expect(msg.text).toContain("Alice");
    expect(msg.text).toContain("Backend");
  });

  it("includes description snippet", () => {
    const msg = formatIssueCreated(mockEvent({ description: "A long description about this issue" }));
    expect(msg.text).toContain("A long description");
  });

  it("truncates long descriptions at word boundary", () => {
    const words = Array(50).fill("word").join(" ");
    const msg = formatIssueCreated(mockEvent({ description: words }));
    expect(msg.text).toContain("\\.\\.\\.");
    expect(msg.text.length).toBeLessThan(words.length * 2);
  });

  it("omits metadata line when no metadata", () => {
    const msg = formatIssueCreated(mockEvent({
      status: undefined,
      priority: undefined,
      assigneeName: undefined,
      projectName: undefined,
    }));
    expect(msg.text).not.toContain("\\|");
  });
});

describe("formatIssueDone", () => {
  it("uses the short Ukrainian completion format", () => {
    const msg = formatIssueDone(mockEvent());
    expect(msg.text).toContain("PROJ\\-42");
    expect(msg.text).toContain("Готово");
    expect(msg.text).not.toContain("Issue Completed");
    expect(msg.text).not.toContain("is now done");
  });

  it("falls back to entityId", () => {
    const msg = formatIssueDone(mockEvent({ identifier: undefined }));
    expect(msg.text).toContain("iss\\-123");
  });

  it("includes comment when provided", () => {
    const msg = formatIssueDone(mockEvent({ comment: "Board prep package completed for Q3" }));
    expect(msg.text).toContain("Board prep package completed for Q3");
    expect(msg.text).toContain("Що зроблено");
  });

  it("does not forward raw technical markdown as a completion summary", () => {
    const msg = formatIssueDone(mockEvent({
      title: "Restore Telegram message-id proof for AST-827 Chinese horoscope delivery",
      comment: "## Result\n\nTelegram proof was **not** restored. `AST-828` is complete as a diagnosis/routing lane.",
    }));

    expect(msg.text).not.toContain("Що зроблено");
    expect(msg.text).not.toContain("diagnosis");
    expect(msg.text).not.toContain("##");
  });

  it("truncates long comments", () => {
    const longComment = Array(80).fill("word").join(" ");
    const msg = formatIssueDone(mockEvent({ comment: longComment }));
    expect(msg.text).toContain("\\.\\.\\.");
  });

  it("omits comment section when no comment", () => {
    const msg = formatIssueDone(mockEvent());
    const lines = msg.text.split("\n").filter((l: string) => l.trim());
    expect(lines.length).toBe(2);
  });

  it("uses a CMS draft-ready message with a direct draft button", () => {
    const draftUrl = "https://cms.astrogen.com.ua/admin/collections/blogPosts/38";
    const msg = formatIssueDone(
      mockEvent({
        companyName: "Astrogen",
        title: "Що робити, якщо точний час народження дитини невідомий",
        comment: [
          "Payload CMS draft ready.",
          "CMS state: draft.",
          "Cover image uploaded and coverImage set.",
          `Draft/admin URL: ${draftUrl}`,
        ].join("\n"),
      }),
      { baseUrl: "https://paperclip.example", issuePrefix: "AST" },
    );

    expect(msg.text).toContain("Чернетка готова");
    expect(msg.text).toContain("Статтю створено в CMS як чернетку");
    expect(msg.text).toContain("Cover\\-зображення додано");
    expect(msg.text).toContain("https://cms\\.astrogen\\.com\\.ua/admin/collections/blogPosts/38");
    expect(msg.text).not.toContain("Що зроблено");
    expect(msg.options.inlineKeyboard?.[0]?.[0]).toEqual({ text: "Відкрити чернетку", url: draftUrl });
    expect(msg.options.inlineKeyboard?.[1]?.[0]?.text).toBe("Відкрити задачу");
  });

  it("uses an owner-facing SEO indexing fix explanation", () => {
    const msg = formatIssueDone(
      mockEvent({
        identifier: "AST-1043",
        companyName: "Astrogen",
        title: "Fix published blog noindex and sitemap visibility for sumisnosti-znakiv-zodiaku-yak-chytaty-tablytsiu",
        comment: [
          "## Fixed",
          "- URL: `https://astrogen.com.ua/blog/stosunky/sumisnosti-znakiv-zodiaku-yak-chytaty-tablytsiu/`",
          "- Fields changed in CMS post `45`: `noindex` `true -> false`; `canonicalUrl` changed.",
          "- Live after: category URL returns `200`, no robots `noindex` meta is present, canonical is correct, and the URL is now present in the live blog sitemap.",
        ].join("\n"),
      }),
      { baseUrl: "https://paperclip.example", issuePrefix: "AST" },
    );

    expect(msg.text).toContain("Виправлено індексацію статті");
    expect(msg.text).toContain("Що було");
    expect(msg.text).toContain("Що це означає");
    expect(msg.text).toContain("Search Console");
    expect(msg.text).not.toContain("Fields changed");
    expect(msg.text).not.toContain("CMS post");
    expect(msg.options.disableWebPagePreview).toBe(true);
  });
});

describe("formatIssueAssigned", () => {
  it("shows the assigned user when assigning from nobody", () => {
    const msg = formatIssueAssigned(mockEvent({
      assigneeUserId: "user-me",
      assigneeName: "Nuno",
      _previous: { assigneeUserId: null, assigneeName: null },
    }));
    expect(msg.text).toContain("Issue Assigned");
    expect(msg.text).toContain("PROJ\\-42");
    expect(msg.text).toContain("Nuno");
    // No previous-name line
    expect(msg.text).not.toContain("→");
  });

  it("shows 'previous → new' when reassigning from another user", () => {
    const msg = formatIssueAssigned(mockEvent({
      assigneeUserId: "user-me",
      assigneeName: "Nuno",
      _previous: { assigneeUserId: "user-other", assigneeName: "Alice" },
    }));
    expect(msg.text).toContain("Alice");
    expect(msg.text).toContain("Nuno");
    expect(msg.text).toContain("→");
  });

  it("shows 'Unassigned' when the new assignee is null", () => {
    const msg = formatIssueAssigned(mockEvent({
      assigneeUserId: null,
      assigneeName: null,
      _previous: { assigneeUserId: "user-me", assigneeName: "Nuno" },
    }));
    expect(msg.text).toContain("Unassigned");
  });

  it("uses MarkdownV2 parse mode", () => {
    const msg = formatIssueAssigned(mockEvent({ assigneeName: "Nuno" }));
    expect(msg.options.parseMode).toBe("MarkdownV2");
  });

  it("falls back to entityId when no identifier", () => {
    const msg = formatIssueAssigned(mockEvent({ identifier: undefined, assigneeName: "Nuno" }));
    expect(msg.text).toContain("iss\\-123");
  });
});

describe("formatApprovalCreated", () => {
  it("includes approve and reject buttons", () => {
    const msg = formatApprovalCreated(mockEvent({
      type: "deploy",
      approvalId: "apr-1",
      title: "Deploy to prod",
    }));
    expect(msg.options.inlineKeyboard).toBeDefined();
    const buttons = msg.options.inlineKeyboard![0];
    expect(buttons.length).toBe(2);
    expect(buttons[0].text).toBe("Approve");
    expect(buttons[0].callback_data).toBe("approve_apr-1");
    expect(buttons[1].text).toBe("Reject");
    expect(buttons[1].callback_data).toBe("reject_apr-1");
  });

  it("falls back to entityId for approvalId", () => {
    const msg = formatApprovalCreated(mockEvent({ approvalId: undefined }));
    const buttons = msg.options.inlineKeyboard![0];
    expect(buttons[0].callback_data).toBe("approve_iss-123");
  });

  it("includes agent name when provided", () => {
    const msg = formatApprovalCreated(mockEvent({
      agentName: "Builder",
      type: "deploy",
    }));
    expect(msg.text).toContain("Builder");
  });

  it("includes linked issues", () => {
    const msg = formatApprovalCreated(mockEvent({
      linkedIssues: [
        { identifier: "ISS-1", title: "First", status: "open" },
        { identifier: "ISS-2", title: "Second", status: "done" },
      ],
    }));
    expect(msg.text).toContain("ISS\\-1");
    expect(msg.text).toContain("ISS\\-2");
    expect(msg.text).toContain("Linked Issues");
  });

  it("truncates description at word boundary", () => {
    const longDesc = Array(80).fill("word").join(" ");
    const msg = formatApprovalCreated(mockEvent({ description: longDesc }));
    expect(msg.text).toContain("\\.\\.\\.");
  });
});

describe("formatAgentError", () => {
  it("includes agent name and error", () => {
    const msg = formatAgentError(mockEvent({
      agentName: "Builder",
      error: "Connection refused",
    }));
    expect(msg.text).toContain("Builder");
    expect(msg.text).toContain("Connection refused");
  });

  it("truncates long error messages", () => {
    const longError = "x".repeat(600);
    const msg = formatAgentError(mockEvent({ error: longError }));
    expect(msg.text).toContain("\\.\\.\\.");
    expect(msg.text).not.toContain("x".repeat(501));
  });

  it("falls back to entityId for agent name", () => {
    const msg = formatAgentError(mockEvent({ agentName: undefined, name: undefined }));
    expect(msg.text).toContain("iss\\-123");
  });
});

describe("formatAgentRunStarted", () => {
  it("includes agent name", () => {
    const msg = formatAgentRunStarted(mockEvent({ agentName: "Deployer" }));
    expect(msg.text).toContain("Deployer");
    expect(msg.text).toContain("started");
  });

  it("disables notification", () => {
    const msg = formatAgentRunStarted(mockEvent());
    expect(msg.options.disableNotification).toBe(true);
  });
});

describe("formatAgentRunFinished", () => {
  it("includes agent name and completion text", () => {
    const msg = formatAgentRunFinished(mockEvent({ agentName: "Deployer" }));
    expect(msg.text).toContain("Deployer");
    expect(msg.text).toContain("completed");
  });

  it("disables notification", () => {
    const msg = formatAgentRunFinished(mockEvent());
    expect(msg.options.disableNotification).toBe(true);
  });
});
