import { describe, expect, it } from "vitest";
import {
  buildIssueAutoReplyComment,
  sanitizeIssueAutoReplyText,
  shouldPostIssueAutoReply,
} from "../services/issue-auto-reply.js";

describe("shouldPostIssueAutoReply", () => {
  it("returns true for issue comment-triggered runs", () => {
    expect(
      shouldPostIssueAutoReply({
        issueId: "issue-1",
        commentId: "comment-1",
        source: "issue.comment",
      }),
    ).toBe(true);
  });

  it("returns true for mention-triggered runs", () => {
    expect(
      shouldPostIssueAutoReply({
        issueId: "issue-1",
        commentId: "comment-1",
        source: "comment.mention",
      }),
    ).toBe(true);
  });

  it("returns false when comment context is missing", () => {
    expect(
      shouldPostIssueAutoReply({
        issueId: "issue-1",
        source: "issue.comment",
      }),
    ).toBe(false);
  });

  it("returns false for non-comment sources", () => {
    expect(
      shouldPostIssueAutoReply({
        issueId: "issue-1",
        commentId: "comment-1",
        source: "issue.update",
      }),
    ).toBe(false);
  });
});

describe("sanitizeIssueAutoReplyText", () => {
  it("removes technical paperclip chatter and path directives", () => {
    expect(
      sanitizeIssueAutoReplyText(
        [
          "[paperclip] Loaded agent instructions file: /astrogen/agents/cto/AGENTS.md",
          "The above agent instructions were loaded from /astrogen/agents/cto/AGENTS.md.",
          "Resolve any relative file references from /astrogen/agents/cto/.",
          "Triggered comment: /AST/issues/AST-11#comment-123",
          "Wake context handled: issue_reopened_via_comment on AST-11",
          "I updated the growth plan and created the next experiment brief.",
        ].join("\n"),
      ),
    ).toBe("I updated the growth plan and created the next experiment brief.");
  });

  it("returns null when only technical lines remain", () => {
    expect(
      sanitizeIssueAutoReplyText(
        [
          "[paperclip] Warning: could not read agent instructions file",
          "tokens: in=12 out=24 cached=0",
          "stdout: /tmp/foo",
          "Confirmed inbox is empty (1)",
        ].join("\n"),
      ),
    ).toBeNull();
  });
});

describe("buildIssueAutoReplyComment", () => {
  it("prefers clean adapter summary for successful runs", () => {
    expect(
      buildIssueAutoReplyComment({
        status: "succeeded",
        summary: "Created `growth/README.md` and clarified the next three workstreams.",
      }),
    ).toBe("Created `growth/README.md` and clarified the next three workstreams.");
  });

  it("falls back to summarized resultJson when summary is missing", () => {
    expect(
      buildIssueAutoReplyComment({
        status: "succeeded",
        resultJson: {
          message: "Updated the issue plan and narrowed the next decision to two options.",
          stdout: "ignored",
        },
      }),
    ).toBe("Updated the issue plan and narrowed the next decision to two options.");
  });

  it("formats failure replies without raw debug output", () => {
    expect(
      buildIssueAutoReplyComment({
        status: "failed",
        errorMessage: "[paperclip] warning\nCould not access the upstream API with the current credentials.",
      }),
    ).toBe("I couldn't complete this request.\n\nCould not access the upstream API with the current credentials.");
  });

  it("formats timeout replies cleanly", () => {
    expect(
      buildIssueAutoReplyComment({
        status: "timed_out",
        errorMessage: "The repository scan did not finish before the timeout.",
      }),
    ).toBe("I couldn't finish this within the allotted time.\n\nThe repository scan did not finish before the timeout.");
  });

  it("renders compact question comments when adapter asks a question", () => {
    expect(
      buildIssueAutoReplyComment({
        status: "succeeded",
        question: {
          prompt: "Which launch direction should I explore next?",
          choices: [
            { key: "a", label: "SEO-first", description: "Prioritize organic acquisition experiments." },
            { key: "b", label: "Paid-first" },
          ],
        },
      }),
    ).toBe(
      "Which launch direction should I explore next?\n\n- **SEO-first**: Prioritize organic acquisition experiments.\n- **Paid-first**",
    );
  });

  it("returns null for cancelled runs", () => {
    expect(
      buildIssueAutoReplyComment({
        status: "cancelled",
        summary: "This should not post.",
      }),
    ).toBeNull();
  });

  it("returns null when there is no safe success content", () => {
    expect(
      buildIssueAutoReplyComment({
        status: "succeeded",
        resultJson: {
          stdout: "AGENTS.md",
          stderr: "[paperclip] nothing useful",
        },
      }),
    ).toBeNull();
  });
});
