import { describe, expect, it } from "vitest";
import type { PipelineCaseOutputItem } from "@paperclipai/shared";
import { sortPipelineCaseOutputItems } from "./pipeline-case-outputs.js";

function output(
  id: string,
  updatedAt: string,
  title: string,
  documentKey: string,
): PipelineCaseOutputItem {
  return {
    id,
    kind: "document",
    title,
    sourceIssueId: `issue-${id}`,
    sourceIssueIdentifier: null,
    sourceIssuePath: `/issues/issue-${id}`,
    sourceIssueTitle: title,
    sourceIssueStatus: "done",
    sourceRole: "work",
    sourceTrust: null,
    sourceRunId: null,
    sourceAgentId: null,
    preview: null,
    createdAt: new Date(updatedAt),
    updatedAt: new Date(updatedAt),
    documentId: `document-${id}`,
    documentKey,
    documentTitle: title,
    format: "markdown",
    latestRevisionId: null,
    latestRevisionNumber: null,
    documentPath: `/issues/issue-${id}#document-${documentKey}`,
  };
}

describe("sortPipelineCaseOutputItems", () => {
  it("keeps the newest manager handoff visible ahead of older named deliverables", () => {
    const outputs = [
      output("old-report", "2026-07-23T10:00:00Z", "Weekly report", "weekly-report"),
      output("old-plan", "2026-07-23T10:01:00Z", "Content plan", "content-plan"),
      output("old-brief", "2026-07-23T10:02:00Z", "Article brief", "article-brief"),
      output("old-summary", "2026-07-23T10:03:00Z", "Run summary", "run-summary"),
      output("old-spec", "2026-07-23T10:04:00Z", "Implementation spec", "implementation-spec"),
      output("manager-action", "2026-07-23T12:49:00Z", "Refill continuation result", "refill-continuation-result"),
    ];

    const visible = outputs.sort(sortPipelineCaseOutputItems).slice(0, 5);

    expect(visible[0]?.id).toBe("manager-action");
    expect(visible.some((item) => item.id === "manager-action")).toBe(true);
  });
});
