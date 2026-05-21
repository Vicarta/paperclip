import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_AUTHORS_COLLECTION,
  DEFAULT_BLOG_POSTS_COLLECTION,
  DEFAULT_BUILD_STATE_GLOBAL,
  DEFAULT_CATEGORIES_COLLECTION,
  DEFAULT_MEDIA_COLLECTION,
  DEFAULT_PAYLOAD_API_BASE_URL,
  DEFAULT_TAGS_COLLECTION,
} from "./constants.js";
import { validateArticleContentV1, type ArticleContentV1 } from "./article-content.js";

export type PayloadCmsPluginConfig = {
  payloadApiKeySecretRef?: string;
  payloadApiBaseUrl?: string;
  authCollectionSlug?: string;
  blogPostsCollectionSlug?: string;
  mediaCollectionSlug?: string;
  categoriesCollectionSlug?: string;
  tagsCollectionSlug?: string;
  authorsCollectionSlug?: string;
  buildStateGlobalSlug?: string;
  requestTimeoutMs?: number;
};

export type BlogPostFields = {
  title?: string;
  slug?: string;
  excerpt?: string;
  articleContent?: ArticleContentV1 | Record<string, unknown>;
  coverImage?: number | string;
  ogImage?: number | string;
  author?: number | string;
  category?: number | string;
  tags?: Array<number | string>;
  relatedPosts?: Array<number | string>;
  workflowStatus?: string;
  publishedAt?: string;
  scheduledPublishAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  extraFields?: Record<string, unknown>;
};

export type PayloadCmsRequestInput = {
  config: PayloadCmsPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: typeof fetch;
};

export type PayloadCmsUploadMediaInput = PayloadCmsRequestInput & {
  filePath: string;
  alt: string;
  caption?: string;
  credit?: string;
  sourceUrl?: string;
};

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeCollectionSlug(value: unknown, fallback: string) {
  return readNonEmptyString(value) ?? fallback;
}

function normalizeBaseUrl(value: unknown) {
  const raw = readNonEmptyString(value) ?? DEFAULT_PAYLOAD_API_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function timeoutMs(config: PayloadCmsPluginConfig) {
  return typeof config.requestTimeoutMs === "number" && Number.isFinite(config.requestTimeoutMs)
    ? Math.max(1000, config.requestTimeoutMs)
    : 60000;
}

async function resolveApiKey(input: PayloadCmsRequestInput) {
  const secretRef = readNonEmptyString(input.config.payloadApiKeySecretRef);
  if (!secretRef) throw new Error("Payload CMS API key secret is not configured");
  const apiKey = await input.resolveSecret(secretRef);
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Payload CMS API key secret resolved to an empty value");
  }
  return apiKey.trim();
}

function authCollection(config: PayloadCmsPluginConfig) {
  return normalizeCollectionSlug(config.authCollectionSlug, "users");
}

function blogPostsCollection(config: PayloadCmsPluginConfig) {
  return normalizeCollectionSlug(config.blogPostsCollectionSlug, DEFAULT_BLOG_POSTS_COLLECTION);
}

function mediaCollection(config: PayloadCmsPluginConfig) {
  return normalizeCollectionSlug(config.mediaCollectionSlug, DEFAULT_MEDIA_COLLECTION);
}

function buildStateGlobal(config: PayloadCmsPluginConfig) {
  return normalizeCollectionSlug(config.buildStateGlobalSlug, DEFAULT_BUILD_STATE_GLOBAL);
}

function taxonomyCollection(config: PayloadCmsPluginConfig, collection: string) {
  if (collection === "categories") {
    return normalizeCollectionSlug(config.categoriesCollectionSlug, DEFAULT_CATEGORIES_COLLECTION);
  }
  if (collection === "tags") {
    return normalizeCollectionSlug(config.tagsCollectionSlug, DEFAULT_TAGS_COLLECTION);
  }
  if (collection === "authors") {
    return normalizeCollectionSlug(config.authorsCollectionSlug, DEFAULT_AUTHORS_COLLECTION);
  }
  throw new Error(`Unsupported taxonomy collection: ${collection}`);
}

function endpoint(config: PayloadCmsPluginConfig, pathname: string) {
  const url = new URL(`${normalizeBaseUrl(config)}${pathname.startsWith("/") ? pathname : `/${pathname}`}`);
  return url;
}

function appendQuery(url: URL, params: Record<string, string | number | boolean | null | undefined>) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
}

async function readPayloadResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null
        ? JSON.stringify(payload)
        : typeof payload === "string"
          ? payload
          : "";
    throw new Error(`Payload CMS request failed (${response.status}): ${detail}`);
  }

  return payload;
}

async function payloadRequest<T>(
  input: PayloadCmsRequestInput & {
    method?: string;
    pathname: string;
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
    formData?: FormData;
  },
): Promise<T> {
  const apiKey = await resolveApiKey(input);
  const fetchFn = input.fetchFn ?? fetch;
  const url = endpoint(input.config, input.pathname);
  if (input.query) appendQuery(url, input.query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(input.config));
  try {
    const headers: Record<string, string> = {
      Authorization: `${authCollection(input.config)} API-Key ${apiKey}`,
      Accept: "application/json",
    };

    let body: BodyInit | undefined;
    if (input.formData) {
      body = input.formData;
    } else if (input.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.body);
    }

    const response = await fetchFn(url.toString(), {
      method: input.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });

    return (await readPayloadResponse(response)) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function buildBlogPostPayload(fields: BlogPostFields, opts?: { publish?: boolean }) {
  const legacyFields = fields as Record<string, unknown>;
  if (legacyFields.content !== undefined || legacyFields.markdown !== undefined || legacyFields.contentHtml !== undefined) {
    throw new Error("Payload CMS blog text must use articleContent.v1; raw Lexical content, markdown, and HTML are not accepted");
  }
  if (
    fields.extraFields &&
    ["content", "markdown", "contentHtml", "articleContent", "_status", "workflowStatus"].some((key) =>
      Object.prototype.hasOwnProperty.call(fields.extraFields, key),
    )
  ) {
    throw new Error("extraFields must not override content, publication, or workflow fields");
  }

  const payload: Record<string, unknown> = {
    ...(fields.extraFields ?? {}),
  };
  const directKeys: Array<keyof BlogPostFields> = [
    "title",
    "slug",
    "excerpt",
    "coverImage",
    "ogImage",
    "author",
    "category",
    "tags",
    "relatedPosts",
    "workflowStatus",
    "publishedAt",
    "scheduledPublishAt",
    "seoTitle",
    "seoDescription",
    "canonicalUrl",
    "noindex",
  ];

  for (const key of directKeys) {
    const value = fields[key];
    if (value !== undefined) payload[key] = value;
  }

  if (fields.articleContent !== undefined) {
    payload.articleContent = validateArticleContentV1(fields.articleContent);
  }

  payload._status = opts?.publish ? "published" : "draft";
  if (!opts?.publish) payload.workflowStatus = "draft";
  if (opts?.publish && !payload.publishedAt) payload.publishedAt = new Date().toISOString();
  return payload;
}

function summarizeDoc(doc: unknown) {
  if (!doc || typeof doc !== "object") return "Payload CMS returned a document.";
  const record = doc as Record<string, unknown>;
  const parts = [
    record.id !== undefined ? `id=${String(record.id)}` : null,
    typeof record.title === "string" ? `title="${record.title}"` : null,
    typeof record.slug === "string" ? `slug=${record.slug}` : null,
    typeof record._status === "string" ? `status=${record._status}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Payload CMS document: ${parts.join(", ")}` : "Payload CMS returned a document.";
}

export async function getBuildState(input: PayloadCmsRequestInput) {
  const data = await payloadRequest<unknown>({
    ...input,
    pathname: `/globals/${buildStateGlobal(input.config)}`,
    query: { depth: 2, draft: false, locale: "undefined", trash: false },
  });
  return {
    content: `Payload CMS build state: ${JSON.stringify(data)}`,
    data,
  };
}

export async function getAccess(input: PayloadCmsRequestInput) {
  const data = await payloadRequest<unknown>({ ...input, pathname: "/access" });
  return {
    content: "Payload CMS access metadata retrieved.",
    data,
  };
}

export async function healthCheck(input: PayloadCmsRequestInput) {
  const [buildState, access] = await Promise.all([
    getBuildState(input),
    getAccess(input),
  ]);
  return {
    content: "Payload CMS is reachable and the configured API key can read build state and access metadata.",
    data: {
      buildState: buildState.data,
      access: access.data,
    },
  };
}

export async function findBlogPost(
  input: PayloadCmsRequestInput & {
    id?: number | string;
    slug?: string;
    depth?: number;
    draft?: boolean;
  },
) {
  const collection = blogPostsCollection(input.config);
  if (input.id !== undefined && input.id !== null && String(input.id).trim().length > 0) {
    const data = await payloadRequest<unknown>({
      ...input,
      pathname: `/${collection}/${encodeURIComponent(String(input.id))}`,
      query: { depth: input.depth ?? 2, draft: input.draft ?? true },
    });
    return { content: summarizeDoc(data), data };
  }

  const slug = readNonEmptyString(input.slug);
  if (!slug) throw new Error("Either id or slug is required to find a Payload blog post");
  const url = endpoint(input.config, `/${collection}`);
  url.searchParams.set("where[slug][equals]", slug);
  appendQuery(url, { limit: 1, depth: input.depth ?? 2, draft: input.draft ?? true });
  const apiKey = await resolveApiKey(input);
  const response = await (input.fetchFn ?? fetch)(url.toString(), {
    headers: {
      Authorization: `${authCollection(input.config)} API-Key ${apiKey}`,
      Accept: "application/json",
    },
  });
  const data = await readPayloadResponse(response) as { docs?: unknown[] };
  const first = Array.isArray(data.docs) ? data.docs[0] ?? null : null;
  return {
    content: first ? summarizeDoc(first) : `No Payload blog post found for slug: ${slug}`,
    data: {
      ...data,
      doc: first,
    },
  };
}

export async function listTaxonomy(
  input: PayloadCmsRequestInput & {
    collection: string;
    limit?: number;
    depth?: number;
  },
) {
  const collection = taxonomyCollection(input.config, input.collection);
  const data = await payloadRequest<unknown>({
    ...input,
    pathname: `/${collection}`,
    query: { limit: input.limit ?? 50, depth: input.depth ?? 0 },
  });
  return {
    content: `Payload CMS ${input.collection} retrieved.`,
    data,
  };
}

function mimeTypeForFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

export async function uploadMedia(input: PayloadCmsUploadMediaInput) {
  const fileBytes = await readFile(input.filePath);
  const form = new FormData();
  const filename = path.basename(input.filePath);
  form.append("file", new Blob([fileBytes], { type: mimeTypeForFile(input.filePath) }), filename);
  form.append("_payload", JSON.stringify({
    alt: input.alt,
    ...(readNonEmptyString(input.caption) ? { caption: input.caption?.trim() } : {}),
    ...(readNonEmptyString(input.credit) ? { credit: input.credit?.trim() } : {}),
    ...(readNonEmptyString(input.sourceUrl) ? { sourceUrl: input.sourceUrl?.trim() } : {}),
  }));

  const data = await payloadRequest<unknown>({
    ...input,
    method: "POST",
    pathname: `/${mediaCollection(input.config)}`,
    formData: form,
  });
  return {
    content: summarizeDoc(data),
    data,
  };
}

export async function createBlogPostDraft(
  input: PayloadCmsRequestInput & BlogPostFields,
) {
  const data = await payloadRequest<unknown>({
    ...input,
    method: "POST",
    pathname: `/${blogPostsCollection(input.config)}`,
    body: buildBlogPostPayload(input),
  });
  return {
    content: summarizeDoc(data),
    data,
  };
}

export async function updateBlogPostDraft(
  input: PayloadCmsRequestInput & {
    id?: number | string;
    slug?: string;
    fields: BlogPostFields;
  },
) {
  let id = input.id;
  if (id === undefined || id === null || String(id).trim().length === 0) {
    const found = await findBlogPost({ ...input, slug: input.slug, draft: true, depth: 0 });
    const doc = (found.data as { doc?: { id?: unknown } }).doc;
    id = doc?.id as string | number | undefined;
  }
  if (id === undefined || id === null || String(id).trim().length === 0) {
    throw new Error("Payload blog post id or an existing slug is required for update");
  }

  const data = await payloadRequest<unknown>({
    ...input,
    method: "PATCH",
    pathname: `/${blogPostsCollection(input.config)}/${encodeURIComponent(String(id))}`,
    body: buildBlogPostPayload(input.fields),
  });
  return {
    content: summarizeDoc(data),
    data,
  };
}

export async function publishBlogPost(
  input: PayloadCmsRequestInput & {
    id?: number | string;
    slug?: string;
    confirmPublish?: boolean;
    publishedAt?: string;
  },
) {
  if (input.confirmPublish !== true) {
    throw new Error("Publishing requires confirmPublish=true after explicit human approval");
  }

  let id = input.id;
  if (id === undefined || id === null || String(id).trim().length === 0) {
    const found = await findBlogPost({ ...input, slug: input.slug, draft: true, depth: 0 });
    const doc = (found.data as { doc?: { id?: unknown } }).doc;
    id = doc?.id as string | number | undefined;
  }
  if (id === undefined || id === null || String(id).trim().length === 0) {
    throw new Error("Payload blog post id or an existing slug is required for publish");
  }

  const data = await payloadRequest<unknown>({
    ...input,
    method: "PATCH",
    pathname: `/${blogPostsCollection(input.config)}/${encodeURIComponent(String(id))}`,
    body: buildBlogPostPayload({ publishedAt: input.publishedAt }, { publish: true }),
  });
  return {
    content: summarizeDoc(data),
    data,
  };
}
