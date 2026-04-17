import { parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";
import { summarizeErrorPayload } from "./shared.js";

type UpsertIssueDocumentInput = {
  apiUrl: string;
  authToken: string;
  runId: string;
  issueId: string;
  key: string;
  title: string | null;
  body: string;
  changeSummary: string | null;
};

type IssueDocumentMetadata = {
  latestRevisionId: string | null;
};

function trimApiUrl(apiUrl: string) {
  return apiUrl.replace(/\/+$/, "");
}

function buildHeaders(input: { authToken: string; runId: string }) {
  return {
    Authorization: `Bearer ${input.authToken}`,
    "Content-Type": "application/json",
    "X-Paperclip-Run-Id": input.runId,
  };
}

function readRevisionId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function readIssueDocumentMetadata(input: {
  apiUrl: string;
  authToken: string;
  runId: string;
  issueId: string;
  key: string;
}): Promise<IssueDocumentMetadata | null> {
  const response = await fetch(
    `${trimApiUrl(input.apiUrl)}/api/issues/${encodeURIComponent(input.issueId)}/documents/${encodeURIComponent(input.key)}`,
    {
      method: "GET",
      headers: buildHeaders(input),
    },
  );

  if (response.status === 404) return null;

  const responseText = await response.text();
  const payload = responseText ? parseJson(responseText) : null;
  if (!response.ok) {
    throw new Error(
      `Paperclip issue document read failed (${response.status}): ${summarizeErrorPayload(payload) || responseText || "unknown error"}`,
    );
  }

  const record = parseObject(payload);
  return {
    latestRevisionId: readRevisionId(record.latestRevisionId),
  };
}

export async function upsertIssueDocumentViaApi(input: UpsertIssueDocumentInput): Promise<void> {
  const docUrl =
    `${trimApiUrl(input.apiUrl)}/api/issues/${encodeURIComponent(input.issueId)}/documents/${encodeURIComponent(input.key)}`;
  const headers = buildHeaders(input);
  const existing = await readIssueDocumentMetadata(input);

  async function putWithBaseRevision(baseRevisionId: string | null, allowRetry: boolean): Promise<void> {
    const response = await fetch(docUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        title: input.title,
        format: "markdown",
        body: input.body,
        changeSummary: input.changeSummary,
        baseRevisionId,
      }),
    });
    const responseText = await response.text();
    const payload = responseText ? parseJson(responseText) : null;
    if (response.ok) return;

    if (response.status === 409 && allowRetry) {
      const currentRevisionId = readRevisionId(parseObject(payload).currentRevisionId);
      const latestRevisionId =
        currentRevisionId ?? (await readIssueDocumentMetadata(input))?.latestRevisionId ?? null;
      return putWithBaseRevision(latestRevisionId, false);
    }

    throw new Error(
      `Paperclip issue document upsert failed (${response.status}): ${summarizeErrorPayload(payload) || responseText || "unknown error"}`,
    );
  }

  await putWithBaseRevision(existing?.latestRevisionId ?? null, true);
}

type UploadIssueArtifactInput = {
  apiUrl: string;
  authToken: string;
  runId: string;
  companyId: string;
  issueId: string;
  relativePath: string;
  body: string;
};

function guessArtifactContentType(relativePath: string) {
  const normalized = relativePath.trim().toLowerCase();
  if (normalized.endsWith(".html")) return "text/html";
  if (normalized.endsWith(".json")) return "application/json";
  if (normalized.endsWith(".txt")) return "text/plain";
  return "text/markdown";
}

function artifactFilename(relativePath: string) {
  const trimmed = relativePath.trim();
  if (!trimmed) return "artifact.md";
  const segments = trimmed.split(/[\\/]+/).filter(Boolean);
  return segments.at(-1) ?? "artifact.md";
}

export async function uploadIssueArtifactViaApi(input: UploadIssueArtifactInput): Promise<void> {
  const url =
    `${trimApiUrl(input.apiUrl)}/api/companies/${encodeURIComponent(input.companyId)}` +
    `/issues/${encodeURIComponent(input.issueId)}/attachments`;
  const formData = new FormData();
  formData.set("file", new File([input.body], artifactFilename(input.relativePath), {
    type: guessArtifactContentType(input.relativePath),
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.authToken}`,
      "X-Paperclip-Run-Id": input.runId,
    },
    body: formData,
  });
  const responseText = await response.text();
  const payload = responseText ? parseJson(responseText) : null;
  if (!response.ok) {
    throw new Error(
      `Paperclip issue artifact upload failed (${response.status}): ${summarizeErrorPayload(payload) || responseText || "unknown error"}`,
    );
  }
}
