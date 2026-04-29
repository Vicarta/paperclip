import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_BRIGHT_DATA_GROUPS,
  DEFAULT_BRIGHT_DATA_MCP_URL,
} from "./constants.js";

export type BrightDataPluginConfig = {
  brightDataTokenSecretRef?: string;
  brightDataMcpUrl?: string;
  brightDataGroups?: string[];
};

type BrightDataDatasetTriggerInput =
  | Array<Record<string, unknown>>
  | Record<string, unknown>;

type BrightDataDatasetTriggerParams = {
  datasetId: string;
  input: BrightDataDatasetTriggerInput;
  includeErrors?: boolean;
  customOutputFields?: string;
  type?: string;
  discoverBy?: string;
  limitPerInput?: number;
  limitMultipleResults?: number;
  notify?: boolean;
  endpoint?: string;
  format?: string;
  authHeader?: string;
  uncompressedWebhook?: boolean;
};

type BrightDataRunDatasetParams = BrightDataDatasetTriggerParams & {
  maxWaitMs?: number;
  pollIntervalMs?: number;
  autoDownload?: boolean;
  downloadFormat?: string;
};

type BrightDataResolveInstagramAccountPostSetParams = {
  handleOrUrl: string;
  expectedPostCount?: number;
  maxPosts?: number;
  allowLargeAccount?: boolean;
  maxWaitMs?: number;
  pollIntervalMs?: number;
  forceRefresh?: boolean;
  cacheTtlHours?: number;
};

type SnapshotProgressPayload = {
  status?: string;
  error_message?: string;
  [key: string]: unknown;
};

type McpTextContent = {
  type?: string;
  text?: string;
};

type McpCallToolResult = {
  content?: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
};

type McpListToolsResult = {
  tools?: Array<{
    name?: string;
    description?: string;
    inputSchema?: unknown;
  }>;
};

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeGroups(groups: unknown) {
  if (!Array.isArray(groups)) return [...DEFAULT_BRIGHT_DATA_GROUPS];
  const normalized = groups
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return normalized.length > 0 ? normalized : [...DEFAULT_BRIGHT_DATA_GROUPS];
}

function ensureToken(token: string | null) {
  if (!token) {
    throw new Error("Bright Data token is not configured for this plugin");
  }
  return token;
}

function normalizeDatasetId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function normalizeSnapshotId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function preview(value: unknown, maxLength = 1200) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n…`;
}

function buildRestUrl(pathname: string, query: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`https://api.brightdata.com${pathname}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function parseBrightDataResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const canParseJson =
    contentType.includes("application/json") ||
    contentType.includes("application/problem+json") ||
    text.trim().startsWith("{") ||
    text.trim().startsWith("[");

  if (canParseJson) {
    try {
      return { rawText: text, parsed: JSON.parse(text) };
    } catch {
      return { rawText: text, parsed: null };
    }
  }
  return { rawText: text, parsed: null };
}

async function brightDataApiRequest<T>(input: {
  token: string;
  pathname: string;
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}) {
  const response = await fetch(buildRestUrl(input.pathname, input.query ?? {}), {
    method: input.method ?? "GET",
    headers: {
      Authorization: `Bearer ${input.token}`,
      ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });

  const { rawText, parsed } = await parseBrightDataResponse(response);
  if (!response.ok) {
    const details = parsed ?? rawText;
    throw new Error(`Bright Data API ${input.pathname} failed (${response.status}): ${preview(details, 500)}`);
  }

  return {
    status: response.status,
    headers: response.headers,
    data: (parsed ?? rawText) as T,
    rawText,
  };
}

async function resolveTokenFromConfig(input: {
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.brightDataTokenSecretRef);
  const token = secretRef ? await input.resolveSecret(secretRef) : null;
  return ensureToken(token);
}

function buildEndpoint(baseUrl: string | undefined, groups: string[], token: string | null) {
  const url = new URL(readNonEmptyString(baseUrl) ?? DEFAULT_BRIGHT_DATA_MCP_URL);
  if (groups.length > 0 && !url.searchParams.has("groups")) {
    url.searchParams.set("groups", groups.join(","));
  }
  if (token && !url.searchParams.has("token")) {
    url.searchParams.set("token", token);
  }
  return url;
}

function flattenToolContent(content: unknown[] | undefined) {
  if (!Array.isArray(content) || content.length === 0) return null;
  const textParts = content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as McpTextContent;
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text.trim()
        : null;
    })
    .filter((value): value is string => Boolean(value));

  if (textParts.length > 0) return textParts.join("\n\n");
  return JSON.stringify(content);
}

export function normalizeToolResult(result: McpCallToolResult) {
  const content = flattenToolContent(result.content) ?? (
    result.structuredContent == null
      ? null
      : JSON.stringify(result.structuredContent, null, 2)
  );

  return {
    isError: result.isError === true,
    content: content ?? "",
    data: {
      structuredContent: result.structuredContent ?? null,
      content: result.content ?? [],
    },
  };
}

export async function withBrightDataClient<T>(input: {
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fn: (client: Client) => Promise<T>;
}) {
  const token = await resolveTokenFromConfig(input);
  const endpoint = buildEndpoint(
    input.config.brightDataMcpUrl,
    normalizeGroups(input.config.brightDataGroups),
    ensureToken(token),
  );

  const transport = new StreamableHTTPClientTransport(endpoint);
  const client = new Client(
    { name: "paperclip-bright-data-agent-tools", version: "0.2.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    return await input.fn(client);
  } finally {
    await client.close();
  }
}

export async function listBrightDataTools(input: {
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  return await withBrightDataClient({
    ...input,
    fn: async (client) => {
      const result = await client.listTools();
      const payload = result as McpListToolsResult;
      const tools = Array.isArray(payload.tools) ? payload.tools : [];
      return {
        content: tools.length > 0
          ? tools.map((tool) => {
            const name = typeof tool.name === "string" ? tool.name : "(unnamed)";
            const description = typeof tool.description === "string" ? tool.description : "";
            return description ? `${name}: ${description}` : name;
          }).join("\n")
          : "No Bright Data MCP tools were returned.",
        data: {
          tools: tools.map((tool) => ({
            name: typeof tool.name === "string" ? tool.name : "",
            description: typeof tool.description === "string" ? tool.description : "",
            inputSchema: tool.inputSchema ?? null,
          })),
        },
      };
    },
  });
}

export async function callBrightDataTool(input: {
  remoteToolName: string;
  args: Record<string, unknown>;
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  return await withBrightDataClient({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fn: async (client) => {
      const result = await client.callTool({
        name: input.remoteToolName,
        arguments: input.args,
      });
      return normalizeToolResult(result as McpCallToolResult);
    },
  });
}

function buildTriggerQuery(params: BrightDataDatasetTriggerParams) {
  const query: Record<string, string | number | boolean | undefined> = {
    dataset_id: normalizeDatasetId(params.datasetId),
    include_errors: params.includeErrors,
    custom_output_fields: readNonEmptyString(params.customOutputFields) ?? undefined,
    type: readNonEmptyString(params.type) ?? undefined,
    discover_by: readNonEmptyString(params.discoverBy) ?? undefined,
    limit_per_input: normalizeNumber(params.limitPerInput),
    limit_multiple_results: normalizeNumber(params.limitMultipleResults),
    notify: normalizeBoolean(params.notify),
    endpoint: readNonEmptyString(params.endpoint) ?? undefined,
    format: readNonEmptyString(params.format) ?? undefined,
    auth_header: readNonEmptyString(params.authHeader) ?? undefined,
    uncompressed_webhook: normalizeBoolean(params.uncompressedWebhook),
  };
  return query;
}

function normalizeTriggerInput(input: BrightDataDatasetTriggerInput) {
  if (Array.isArray(input)) return input;
  if (isRecord(input)) {
    if (Array.isArray(input.input)) return input.input;
    return [input];
  }
  throw new Error('"input" must be an object or an array of objects');
}

export async function triggerBrightDataDatasetRequest(input: {
  params: BrightDataDatasetTriggerParams;
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const datasetId = normalizeDatasetId(input.params.datasetId);
  if (!datasetId) {
    throw new Error('"datasetId" is required');
  }

  const normalizedInput = normalizeTriggerInput(input.params.input);
  const token = await resolveTokenFromConfig(input);
  const response = await brightDataApiRequest<{ snapshot_id?: string }>({
    token,
    pathname: "/datasets/v3/trigger",
    method: "POST",
    query: buildTriggerQuery({ ...input.params, datasetId }),
    body: normalizedInput,
  });

  const snapshotId = normalizeSnapshotId(isRecord(response.data) ? response.data.snapshot_id : undefined);
  if (!snapshotId) {
    throw new Error(`Bright Data trigger response did not include a snapshot_id: ${preview(response.data, 500)}`);
  }

  return {
    content: `Triggered Bright Data dataset request for ${datasetId}. Snapshot ID: ${snapshotId}`,
    data: {
      datasetId,
      snapshotId,
      response: response.data,
    },
  };
}

export async function getBrightDataSnapshotProgress(input: {
  snapshotId: string;
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const snapshotId = normalizeSnapshotId(input.snapshotId);
  if (!snapshotId) {
    throw new Error('"snapshotId" is required');
  }

  const token = await resolveTokenFromConfig(input);
  const response = await brightDataApiRequest<SnapshotProgressPayload>({
    token,
    pathname: `/datasets/v3/progress/${snapshotId}`,
  });
  const payload = isRecord(response.data) ? response.data : {};
  const status = readNonEmptyString(payload.status) ?? "unknown";
  return {
    content: `Snapshot ${snapshotId} status: ${status}`,
    data: {
      snapshotId,
      status,
      response: response.data,
    },
  };
}

export async function downloadBrightDataSnapshot(input: {
  snapshotId: string;
  format?: string;
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const snapshotId = normalizeSnapshotId(input.snapshotId);
  if (!snapshotId) {
    throw new Error('"snapshotId" is required');
  }

  const format = readNonEmptyString(input.format) ?? "json";
  const token = await resolveTokenFromConfig(input);
  const response = await brightDataApiRequest<unknown>({
    token,
    pathname: `/datasets/v3/snapshot/${snapshotId}`,
    query: {
      format,
    },
  });

  const data = response.data;
  const itemCount = Array.isArray(data) ? data.length : undefined;
  const summary = itemCount !== undefined
    ? `Downloaded snapshot ${snapshotId} (${itemCount} item${itemCount === 1 ? "" : "s"})`
    : `Downloaded snapshot ${snapshotId}`;

  return {
    content: `${summary}\n\nPreview:\n${preview(data)}`,
    data: {
      snapshotId,
      format,
      itemCount: itemCount ?? null,
      snapshot: data,
    },
  };
}

function readProgressStatus(progress: unknown) {
  if (!isRecord(progress)) return "unknown";
  return readNonEmptyString(progress.status) ?? "unknown";
}

function isTerminalProgress(status: string) {
  return ["ready", "failed", "error", "aborted"].includes(status.toLowerCase());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeInstagramHandle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0]?.replace(/^@/, "").trim() ?? "";
    } catch {
      return "";
    }
  }

  const withoutAt = trimmed.replace(/^@/, "");
  return withoutAt.split("/").filter(Boolean)[0] ?? "";
}

function normalizeInstagramPostUrl(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().replace(/\/+$/, "")
    : "";
}

function chunkArray<T>(items: T[], size: number) {
  const normalizedSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedSize) {
    chunks.push(items.slice(index, index + normalizedSize));
  }
  return chunks;
}

export async function runBrightDataDatasetRequest(input: {
  params: BrightDataRunDatasetParams;
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const trigger = await triggerBrightDataDatasetRequest({
    params: input.params,
    config: input.config,
    resolveSecret: input.resolveSecret,
  });
  const snapshotId = trigger.data.snapshotId as string;
  const maxWaitMs = Math.max(1_000, normalizeNumber(input.params.maxWaitMs) ?? 120_000);
  const pollIntervalMs = Math.max(1_000, normalizeNumber(input.params.pollIntervalMs) ?? 5_000);
  const autoDownload = input.params.autoDownload !== false;
  const startedAt = Date.now();

  let lastProgress: unknown = null;
  let lastStatus = "unknown";

  while (Date.now() - startedAt < maxWaitMs) {
    const progress = await getBrightDataSnapshotProgress({
      snapshotId,
      config: input.config,
      resolveSecret: input.resolveSecret,
    });
    lastProgress = progress.data.response;
    lastStatus = readProgressStatus(progress.data.response);

    if (isTerminalProgress(lastStatus)) {
      if (lastStatus.toLowerCase() !== "ready") {
        return {
          content: `Bright Data dataset request finished with status ${lastStatus}. Snapshot ID: ${snapshotId}`,
          data: {
            snapshotId,
            status: lastStatus,
            progress: lastProgress,
            trigger: trigger.data,
          },
        };
      }

      if (!autoDownload) {
        return {
          content: `Bright Data dataset request is ready. Snapshot ID: ${snapshotId}`,
          data: {
            snapshotId,
            status: lastStatus,
            progress: lastProgress,
            trigger: trigger.data,
          },
        };
      }

      const snapshot = await downloadBrightDataSnapshot({
        snapshotId,
        format: input.params.downloadFormat ?? input.params.format,
        config: input.config,
        resolveSecret: input.resolveSecret,
      });
      return {
        content: `Bright Data dataset request is ready. Snapshot ID: ${snapshotId}\n\n${snapshot.content}`,
        data: {
          snapshotId,
          status: lastStatus,
          progress: lastProgress,
          trigger: trigger.data,
          snapshot: snapshot.data.snapshot,
          itemCount: snapshot.data.itemCount,
          format: snapshot.data.format,
        },
      };
    }

    await sleep(pollIntervalMs);
  }

  return {
    content: `Bright Data dataset request timed out after ${maxWaitMs}ms. Snapshot ID: ${snapshotId}. Last known status: ${lastStatus}`,
    data: {
      snapshotId,
      status: lastStatus,
      progress: lastProgress,
      trigger: trigger.data,
      timedOut: true,
    },
  };
}

export async function resolveInstagramAccountPostSet(input: {
  params: BrightDataResolveInstagramAccountPostSetParams;
  config: BrightDataPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const handle = normalizeInstagramHandle(input.params.handleOrUrl);
  if (!handle) {
    throw new Error('"handleOrUrl" must be an Instagram handle or profile URL');
  }

  const profileUrl = `https://www.instagram.com/${handle}/`;
  const maxWaitMs = Math.max(1_000, normalizeNumber(input.params.maxWaitMs) ?? 120_000);
  const pollIntervalMs = Math.max(1_000, normalizeNumber(input.params.pollIntervalMs) ?? 5_000);

  const profileRun = await runBrightDataDatasetRequest({
    params: {
      datasetId: "gd_l1vikfch901nx3by4",
      type: "discover_new",
      discoverBy: "user_name",
      input: [{ user_name: handle }],
      maxWaitMs,
      pollIntervalMs,
      autoDownload: true,
      downloadFormat: "json",
    },
    config: input.config,
    resolveSecret: input.resolveSecret,
  });

  const profileSnapshot = Array.isArray(profileRun.data.snapshot) ? profileRun.data.snapshot : [];
  const profile = isRecord(profileSnapshot[0]) ? profileSnapshot[0] : {};
  const embeddedPosts = Array.isArray(profile.posts) ? profile.posts.filter(isRecord) : [];
  const embeddedUrls = new Set(
    embeddedPosts
      .map((item) => normalizeInstagramPostUrl(item.url))
      .filter((value) => value.length > 0),
  );

  const visiblePostCount =
    normalizeNumber(profile.posts_count) ??
    normalizeNumber(input.params.expectedPostCount) ??
    undefined;
  const maxPosts = Math.max(1, Math.floor(normalizeNumber(input.params.maxPosts) ?? 180));
  const allowLargeAccount = input.params.allowLargeAccount === true;
  const effectivePostLimit =
    visiblePostCount === undefined
      ? maxPosts
      : allowLargeAccount
        ? visiblePostCount
        : Math.min(visiblePostCount, maxPosts);
  const coverageLimited =
    visiblePostCount !== undefined && !allowLargeAccount && visiblePostCount > effectivePostLimit;

  const supplementalInput: Record<string, unknown> = { url: profileUrl };
  supplementalInput.num_of_posts = effectivePostLimit;

  const supplementalRun = await runBrightDataDatasetRequest({
    params: {
      datasetId: "gd_lk5ns7kz21pck8jpis",
      type: "discover_new",
      discoverBy: "url",
      input: [supplementalInput],
      maxWaitMs,
      pollIntervalMs,
      autoDownload: true,
      downloadFormat: "json",
    },
    config: input.config,
    resolveSecret: input.resolveSecret,
  });

  const supplementalSnapshot = Array.isArray(supplementalRun.data.snapshot)
    ? supplementalRun.data.snapshot.filter(isRecord)
    : [];

  const ownerDetailedItems = supplementalSnapshot.filter((item) => {
    const postedBy = normalizeInstagramHandle(typeof item.user_posted === "string" ? item.user_posted : "");
    return postedBy === handle;
  });

  const ownerUrls = new Set(
    ownerDetailedItems
      .map((item) => normalizeInstagramPostUrl(item.url))
      .filter((value) => value.length > 0),
  );

  const canonicalUrls = [...new Set([...ownerUrls, ...embeddedUrls])];
  const missingUrls = canonicalUrls.filter((url) => !ownerUrls.has(url));

  const missingDetailedItems: Record<string, unknown>[] = [];
  for (const chunk of chunkArray(missingUrls, 20)) {
    const collectRun = await runBrightDataDatasetRequest({
      params: {
        datasetId: "gd_lk5ns7kz21pck8jpis",
        input: chunk.map((url) => ({ url })),
        maxWaitMs,
        pollIntervalMs,
        autoDownload: true,
        downloadFormat: "json",
      },
      config: input.config,
      resolveSecret: input.resolveSecret,
    });

    const chunkSnapshot = Array.isArray(collectRun.data.snapshot)
      ? collectRun.data.snapshot.filter(isRecord)
      : [];
    missingDetailedItems.push(...chunkSnapshot);
  }

  const detailedByUrl = new Map<string, Record<string, unknown>>();
  for (const item of ownerDetailedItems) {
    const url = normalizeInstagramPostUrl(item.url);
    if (url) detailedByUrl.set(url, item);
  }
  for (const item of missingDetailedItems) {
    const url = normalizeInstagramPostUrl(item.url);
    if (url) detailedByUrl.set(url, item);
  }

  const finalDetailedItems = canonicalUrls
    .map((url) => detailedByUrl.get(url))
    .filter((value): value is Record<string, unknown> => Boolean(value));

  const collaboratorAuthors = [...new Set(
    finalDetailedItems
      .map((item) => normalizeInstagramHandle(typeof item.user_posted === "string" ? item.user_posted : ""))
      .filter((author) => author.length > 0 && author !== handle),
  )];

  const contentTypeCounts = finalDetailedItems.reduce<Record<string, number>>((acc, item) => {
    const contentType =
      typeof item.content_type === "string" && item.content_type.trim().length > 0
        ? item.content_type.trim()
        : "UNKNOWN";
    acc[contentType] = (acc[contentType] ?? 0) + 1;
    return acc;
  }, {});

  const isComplete =
    visiblePostCount === undefined
      ? finalDetailedItems.length === canonicalUrls.length
      : finalDetailedItems.length === canonicalUrls.length && canonicalUrls.length === visiblePostCount;

  return {
    content: [
      `Resolved Instagram account post set for @${handle}.`,
      `Visible profile posts_count: ${visiblePostCount ?? "unknown"}.`,
      `Canonical URLs: ${canonicalUrls.length}.`,
      `Detailed records: ${finalDetailedItems.length}.`,
      `Missing URLs after enrichment: ${canonicalUrls.length - finalDetailedItems.length}.`,
      coverageLimited ? `Coverage was capped at ${effectivePostLimit} posts; visible profile count is ${visiblePostCount}.` : null,
      isComplete ? "Coverage is complete for the canonical URL set." : "Coverage is incomplete.",
    ].filter((line): line is string => Boolean(line)).join("\n"),
    data: {
      handle,
      profileUrl,
      visiblePostCount: visiblePostCount ?? null,
      requestedPostLimit: effectivePostLimit,
      maxPosts,
      allowLargeAccount,
      coverageLimited,
      embeddedPostCount: embeddedUrls.size,
      ownerCandidateCount: ownerUrls.size,
      canonicalUrlCount: canonicalUrls.length,
      missingUrlCount: missingUrls.length,
      finalDetailedCount: finalDetailedItems.length,
      isComplete,
      collaboratorAuthors,
      contentTypeCounts,
      canonicalUrls,
      missingUrls,
      profile,
      embeddedPosts,
      items: finalDetailedItems,
    },
  };
}
