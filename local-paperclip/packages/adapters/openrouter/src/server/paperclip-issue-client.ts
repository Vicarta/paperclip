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

type PipelineTransitionResult = {
  caseId: string;
  fromStageKey: string | null;
  toStageKey: string;
  version: number | null;
};

export type DeterministicPipelineTransition = {
  fromStageKey: string | null;
  toStageKey: string;
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

export async function resolveSingleAllowedPipelineTransitionViaApi(input: {
  apiUrl: string;
  authToken: string;
  runId: string;
  caseId: string;
}): Promise<DeterministicPipelineTransition | null> {
  const headers = buildHeaders(input);
  const detailResponse = await fetch(
    `${trimApiUrl(input.apiUrl)}/api/cases/${encodeURIComponent(input.caseId)}`,
    { method: "GET", headers },
  );
  const detailText = await detailResponse.text();
  const detailPayload = detailText ? parseJson(detailText) : null;
  if (!detailResponse.ok) {
    throw new Error(
      `Pipeline case read failed (${detailResponse.status}): ${summarizeErrorPayload(detailPayload) || detailText || "unknown error"}`,
    );
  }

  const detail = parseObject(detailPayload);
  const pipeline = parseObject(detail.pipeline);
  const stage = parseObject(detail.stage);
  const pipelineId = typeof pipeline.id === "string" ? pipeline.id.trim() : "";
  const stageId = typeof stage.id === "string" ? stage.id.trim() : "";
  if (!pipelineId || !stageId || pipeline.enforceTransitions !== true) return null;

  const pipelineResponse = await fetch(
    `${trimApiUrl(input.apiUrl)}/api/pipelines/${encodeURIComponent(pipelineId)}`,
    { method: "GET", headers },
  );
  const pipelineText = await pipelineResponse.text();
  const pipelinePayload = pipelineText ? parseJson(pipelineText) : null;
  if (!pipelineResponse.ok) {
    throw new Error(
      `Pipeline read failed (${pipelineResponse.status}): ${summarizeErrorPayload(pipelinePayload) || pipelineText || "unknown error"}`,
    );
  }

  const pipelineDetail = parseObject(pipelinePayload);
  const stages = Array.isArray(pipelineDetail.stages) ? pipelineDetail.stages.map(parseObject) : [];
  const stageById = new Map(stages.flatMap((candidate) => {
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
    const kind = typeof candidate.kind === "string" ? candidate.kind.trim() : "";
    return id && key ? [[id, { key, kind }] as const] : [];
  }));
  const targetKeys = new Set(
    (Array.isArray(pipelineDetail.transitions) ? pipelineDetail.transitions : [])
      .map(parseObject)
      .filter((transition) => transition.fromStageId === stageId)
      .flatMap((transition) => {
        const targetId = typeof transition.toStageId === "string" ? transition.toStageId.trim() : "";
        const target = targetId ? stageById.get(targetId) : null;
        if (!target || target.kind === "cancelled" || target.key === "cancelled") return [];
        return [target.key];
      }),
  );
  if (targetKeys.size !== 1) return null;
  return {
    fromStageKey: typeof stage.key === "string" ? stage.key : null,
    toStageKey: [...targetKeys][0]!,
  };
}

export async function transitionPipelineCaseViaApi(input: {
  apiUrl: string;
  authToken: string;
  runId: string;
  caseId: string;
  toStageKey: string;
  reason: string | null;
}): Promise<PipelineTransitionResult> {
  const headers = buildHeaders(input);
  const detailResponse = await fetch(
    `${trimApiUrl(input.apiUrl)}/api/cases/${encodeURIComponent(input.caseId)}`,
    { method: "GET", headers },
  );
  const detailText = await detailResponse.text();
  const detailPayload = detailText ? parseJson(detailText) : null;
  if (!detailResponse.ok) {
    throw new Error(
      `Pipeline case read failed (${detailResponse.status}): ${summarizeErrorPayload(detailPayload) || detailText || "unknown error"}`,
    );
  }
  const detail = parseObject(detailPayload);
  const caseRecord = parseObject(detail.case);
  const expectedVersion = caseRecord.version;
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("Pipeline case read did not return a valid version.");
  }
  const stage = parseObject(detail.stage);
  const transitionResponse = await fetch(
    `${trimApiUrl(input.apiUrl)}/api/cases/${encodeURIComponent(input.caseId)}/transition`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        toStageKey: input.toStageKey,
        expectedVersion,
        reason: input.reason,
      }),
    },
  );
  const transitionText = await transitionResponse.text();
  const transitionPayload = transitionText ? parseJson(transitionText) : null;
  if (!transitionResponse.ok) {
    throw new Error(
      `Pipeline transition failed (${transitionResponse.status}): ${summarizeErrorPayload(transitionPayload) || transitionText || "unknown error"}`,
    );
  }
  const transitionedCase = parseObject(transitionPayload).case;
  return {
    caseId: input.caseId,
    fromStageKey: typeof stage.key === "string" ? stage.key : null,
    toStageKey: input.toStageKey,
    version: typeof parseObject(transitionedCase).version === "number"
      ? parseObject(transitionedCase).version as number
      : null,
  };
}
