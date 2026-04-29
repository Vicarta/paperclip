export type HeartbeatPromptIssueContext = {
  id: string;
  identifier: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
};

export function buildHeartbeatPromptIssueMarkdown(
  issue: HeartbeatPromptIssueContext | null,
): string | null {
  if (!issue) return null;

  const lines = [
    "## Current Issue",
    `- ID: ${issue.id}`,
    `- Identifier: ${issue.identifier ?? issue.id}`,
    `- Title: ${issue.title}`,
  ];

  if (issue.status) lines.push(`- Status: ${issue.status}`);
  if (issue.priority) lines.push(`- Priority: ${issue.priority}`);

  const description = issue.description?.trim();
  if (description) {
    lines.push("", "### Issue Description", description);
  }

  return `${lines.join("\n")}\n`;
}
