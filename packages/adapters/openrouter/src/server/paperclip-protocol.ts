import { asString, parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";

const ALLOWED_ISSUE_STATUSES = new Set(["done", "blocked", "in_review", "todo"]);

export type OpenRouterIssueDocumentIntent = {
  key: string;
  title: string | null;
  body: string;
  changeSummary: string | null;
};

export type OpenRouterIssueArtifactIntent = {
  relativePath: string;
  body: string;
};

export type OpenRouterIssueProtocolIntent = {
  status: "done" | "blocked" | "in_review" | "todo" | null;
  comment: string | null;
  document: OpenRouterIssueDocumentIntent | null;
  artifact: OpenRouterIssueArtifactIntent | null;
};

function readTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractJsonObjectText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = /```json\s*([\s\S]*?)\s*```/i.exec(trimmed) ?? /```\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1).trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  }
  return null;
}

export function parseOpenRouterIssueProtocolIntent(text: string): OpenRouterIssueProtocolIntent | null {
  const jsonText = extractJsonObjectText(text);
  if (!jsonText) return null;

  const parsed = parseJson(jsonText);
  if (!parsed) return null;
  const record = parseObject(parsed);

  const rawStatus = readTrimmed(record.status);
  const status =
    rawStatus && ALLOWED_ISSUE_STATUSES.has(rawStatus)
      ? (rawStatus as OpenRouterIssueProtocolIntent["status"])
      : null;
  const comment = readTrimmed(record.comment);

  const documentRecord = parseObject(record.document);
  const documentBody = readTrimmed(documentRecord.body);
  const documentKey = readTrimmed(documentRecord.key) ?? "draft";
  const document =
    documentBody
      ? {
          key: documentKey.toLowerCase(),
          title: readTrimmed(documentRecord.title),
          body: documentBody,
          changeSummary: readTrimmed(documentRecord.changeSummary),
        }
      : null;

  const artifactRecord = parseObject(record.artifact);
  const artifactRelativePath = readTrimmed(artifactRecord.relativePath);
  const artifactBody = readTrimmed(artifactRecord.body);
  const artifact =
    artifactRelativePath && artifactBody
      ? {
          relativePath: artifactRelativePath,
          body: artifactBody,
        }
      : null;

  if (!status && !comment && !document && !artifact) return null;
  return { status, comment, document, artifact };
}

export function buildOpenRouterIssueProtocolInstruction(input: {
  issueIdentifier: string | null;
  issueId: string | null;
}) {
  const issueLabel = input.issueIdentifier ?? input.issueId ?? "current issue";
  return [
    "Return ONLY one JSON object with no prose outside the JSON.",
    `You are responding for ${issueLabel}.`,
    'Schema:',
    '{',
    '  "status": "done" | "blocked" | "in_review" | "todo",',
    '  "comment": "short markdown issue update",',
    '  "document": {',
    '    "key": "draft",',
    '    "title": "document title",',
    '    "body": "full markdown body",',
    '    "changeSummary": "short revision note"',
    '  } | null,',
    '  "artifact": {',
    '    "relativePath": "work/59-seo-blog-article-drafts/active/ast-152-money-ua-2026-04-07.md",',
    '    "body": "full markdown body"',
    "  } | null",
    '}',
    'Rules:',
    '- If the task produces a long-form draft or another canonical workspace artifact, put the full markdown in artifact.body and use artifact.relativePath with the canonical project-relative file path.',
    '- Prefer artifact for long-form article drafts and other repo-native markdown deliverables.',
    '- Use document.key="draft" unless the issue explicitly requires another key.',
    '- Use status="blocked" only for a true blocker that prevents completion now.',
    '- Use status="done" when the requested deliverable is complete.',
    '- Keep comment concise and operational.',
  ].join("\n");
}
