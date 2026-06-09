import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
  categorySlug?: string;
  categoryTitle?: string;
  ensureCategory?: boolean;
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

export type PayloadCmsEnsureTaxonomyTermInput = PayloadCmsRequestInput & {
  collection: string;
  title: string;
  slug?: string;
  description?: string;
};

export type PayloadCmsDeleteTaxonomyTermInput = PayloadCmsRequestInput & {
  collection: string;
  id: number | string;
  expectedSlug?: string;
  expectedTitle?: string;
  confirmDeleteTaxonomyTerm?: boolean;
};

export type PayloadCmsUpdateTaxonomyTermInput = PayloadCmsRequestInput & {
  collection: string;
  id?: number | string;
  slug?: string;
  expectedSlug?: string;
  expectedTitle?: string;
  fields: {
    title?: string;
    name?: string;
    slug?: string;
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
    bio?: string;
    roleTitle?: string;
    photo?: number | string;
    socialLinks?: Array<Record<string, unknown>>;
    extraFields?: Record<string, unknown>;
  };
};

export type PayloadCmsEnsureAuthorInput = PayloadCmsRequestInput & {
  name: string;
  slug?: string;
  expertUrl?: string;
  bio?: string;
  roleTitle?: string;
  photo?: number | string;
  extraFields?: Record<string, unknown>;
};

export type PayloadCmsCleanupTechnicalBlogPostDraftInput = PayloadCmsRequestInput & {
  id?: number | string;
  slug?: string;
  expectedSlug?: string;
  expectedTitle?: string;
  confirmTechnicalDraftCleanup?: boolean;
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

function taxonomyTitleField(collection: string) {
  return collection === "authors" ? "name" : "title";
}

function slugifyAuthor(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яіїєґё]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

async function payloadMultipartRequest<T>(
  input: PayloadCmsRequestInput & {
    method?: string;
    pathname: string;
    query?: Record<string, string | number | boolean | null | undefined>;
    formData: FormData;
  },
): Promise<T> {
  const apiKey = await resolveApiKey(input);
  const url = endpoint(input.config, input.pathname);
  if (input.query) appendQuery(url, input.query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(input.config));
  try {
    // The current plugin host HTTP bridge serializes non-string bodies with
    // String(body), which destroys multipart FormData. Use native fetch only for
    // multipart uploads; normal JSON/read calls still go through ctx.http.fetch.
    const response = await fetch(url.toString(), {
      method: input.method ?? "POST",
      headers: {
        Authorization: `${authCollection(input.config)} API-Key ${apiKey}`,
        Accept: "application/json",
      },
      body: input.formData,
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

function isPublishedOrApprovedBlogPost(doc: Record<string, unknown>) {
  return doc._status === "published" || doc.workflowStatus === "approved" || typeof doc.publishedAt === "string";
}

function isTechnicalDraftCandidate(doc: Record<string, unknown>) {
  const haystack = [
    typeof doc.slug === "string" ? doc.slug : "",
    typeof doc.title === "string" ? doc.title : "",
  ].join(" ").toLowerCase();

  return [
    "smoke-test",
    "smoke test",
    "raw-category",
    "technical-test",
    "test draft",
  ].some((marker) => haystack.includes(marker));
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

export async function listBlogPosts(
  input: PayloadCmsRequestInput & {
    status?: "published" | "draft" | "any";
    workflowStatus?: string;
    publishedFrom?: string;
    publishedTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    limit?: number;
    page?: number;
    depth?: number;
    sort?: string;
  },
) {
  const limit = Math.min(Math.max(Number(input.limit ?? 50), 1), 100);
  const query: Record<string, string | number | boolean | null | undefined> = {
    limit,
    page: input.page ?? 1,
    depth: input.depth ?? 0,
    draft: true,
    sort: input.sort ?? "-publishedAt",
  };

  if (input.status && input.status !== "any") {
    query["where[_status][equals]"] = input.status;
  }
  const workflowStatus = readNonEmptyString(input.workflowStatus);
  if (workflowStatus) query["where[workflowStatus][equals]"] = workflowStatus;

  const publishedFrom = readNonEmptyString(input.publishedFrom);
  const publishedTo = readNonEmptyString(input.publishedTo);
  const updatedFrom = readNonEmptyString(input.updatedFrom);
  const updatedTo = readNonEmptyString(input.updatedTo);
  if (publishedFrom) query["where[publishedAt][greater_than_equal]"] = publishedFrom;
  if (publishedTo) query["where[publishedAt][less_than_equal]"] = publishedTo;
  if (updatedFrom) query["where[updatedAt][greater_than_equal]"] = updatedFrom;
  if (updatedTo) query["where[updatedAt][less_than_equal]"] = updatedTo;

  const data = await payloadRequest<{
    docs?: unknown[];
    totalDocs?: number;
    page?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  }>({
    ...input,
    pathname: `/${blogPostsCollection(input.config)}`,
    query,
  });

  const docs = Array.isArray(data.docs) ? data.docs : [];
  const totalDocs = typeof data.totalDocs === "number" ? data.totalDocs : docs.length;
  return {
    content: `Payload CMS blog posts: ${totalDocs} matched, ${docs.length} returned.`,
    data: {
      ...data,
      filters: {
        status: input.status ?? "any",
        workflowStatus: workflowStatus ?? null,
        publishedFrom: publishedFrom ?? null,
        publishedTo: publishedTo ?? null,
        updatedFrom: updatedFrom ?? null,
        updatedTo: updatedTo ?? null,
      },
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

export async function findTaxonomyTerm(
  input: PayloadCmsRequestInput & {
    collection: string;
    slug?: string;
    title?: string;
    limit?: number;
    depth?: number;
  },
) {
  const collection = taxonomyCollection(input.config, input.collection);
  const slug = readNonEmptyString(input.slug);
  const title = readNonEmptyString(input.title);
  if (!slug && !title) throw new Error("Payload taxonomy term requires slug or title");

  const query: Record<string, string | number | boolean> = {
    limit: input.limit ?? 1,
    depth: input.depth ?? 0,
  };
  if (slug) {
    query["where[slug][equals]"] = slug;
  } else if (title) {
    query[`where[${taxonomyTitleField(input.collection)}][equals]`] = title;
  }

  const data = await payloadRequest<{ docs?: unknown[] }>({
    ...input,
    pathname: `/${collection}`,
    query,
  });
  const first = Array.isArray(data.docs) ? data.docs[0] ?? null : null;
  return {
    content: first
      ? summarizeDoc(first)
      : `No Payload CMS ${input.collection} term found for ${slug ? `slug: ${slug}` : `title: ${title}`}`,
    data: {
      ...data,
      doc: first,
    },
  };
}

export async function ensureTaxonomyTerm(input: PayloadCmsEnsureTaxonomyTermInput) {
  if (!["categories", "tags"].includes(input.collection)) {
    throw new Error("Payload taxonomy creation is supported only for categories and tags");
  }
  const title = readNonEmptyString(input.title);
  if (!title) throw new Error("Payload taxonomy title is required");
  const slug = readNonEmptyString(input.slug);
  const existing = await findTaxonomyTerm({
    ...input,
    slug: slug ?? undefined,
    title,
    limit: 1,
    depth: 0,
  });
  const existingDoc = (existing.data as { doc?: unknown }).doc;
  if (existingDoc) {
    return {
      content: `Payload CMS ${input.collection} term already exists. ${summarizeDoc(existingDoc)}`,
      data: {
        doc: existingDoc,
        created: false,
      },
    };
  }

  const body: Record<string, unknown> = {
    title,
    ...(slug ? { slug } : {}),
    ...(readNonEmptyString(input.description) ? { description: input.description?.trim() } : {}),
  };
  const data = await payloadRequest<unknown>({
    ...input,
    method: "POST",
    pathname: `/${taxonomyCollection(input.config, input.collection)}`,
    body,
  });
  return {
    content: `Payload CMS ${input.collection} term created. ${summarizeDoc(data)}`,
    data: {
      doc: data,
      created: true,
    },
  };
}

export async function updateTaxonomyTerm(input: PayloadCmsUpdateTaxonomyTermInput) {
  if (!["categories", "tags", "authors"].includes(input.collection)) {
    throw new Error("Payload taxonomy update is supported only for categories, tags, and authors");
  }

  const id = input.id !== undefined && input.id !== null && String(input.id).trim().length > 0
    ? String(input.id).trim()
    : null;
  const slugSelector = readNonEmptyString(input.slug);
  if (!id && !slugSelector) {
    throw new Error("Payload taxonomy update requires id or slug");
  }

  let target: Record<string, unknown> | null;
  if (id) {
    target = await payloadRequest<Record<string, unknown>>({
      ...input,
      pathname: `/${taxonomyCollection(input.config, input.collection)}/${encodeURIComponent(id)}`,
      query: { depth: 0 },
    });
  } else {
    const lookup = await findTaxonomyTerm({
      ...input,
      collection: input.collection,
      slug: slugSelector ?? undefined,
      limit: 1,
      depth: 0,
    });
    target = ((lookup.data as { doc?: Record<string, unknown> }).doc ?? null);
  }

  if (!target) {
    throw new Error(`No Payload CMS ${input.collection} term found for ${id ? `id ${id}` : `slug ${slugSelector}`}`);
  }

  const expectedSlug = readNonEmptyString(input.expectedSlug);
  if (expectedSlug && target.slug !== expectedSlug) {
    throw new Error(`Refusing taxonomy update: expected slug ${expectedSlug}, got ${String(target.slug ?? "")}`);
  }

  const expectedTitle = readNonEmptyString(input.expectedTitle);
  const titleField = taxonomyTitleField(input.collection);
  if (expectedTitle && target[titleField] !== expectedTitle) {
    throw new Error(
      `Refusing taxonomy update: expected ${titleField} ${expectedTitle}, got ${String(target[titleField] ?? "")}`,
    );
  }

  const fields = input.fields && typeof input.fields === "object" && !Array.isArray(input.fields)
    ? input.fields
    : null;
  if (!fields) throw new Error("Payload taxonomy update requires fields");

  const extraFields = fields.extraFields ?? {};
  if (
    Object.prototype.hasOwnProperty.call(extraFields, "id") ||
    Object.prototype.hasOwnProperty.call(extraFields, "createdAt") ||
    Object.prototype.hasOwnProperty.call(extraFields, "updatedAt")
  ) {
    throw new Error("Taxonomy extraFields must not override system fields");
  }

  const body: Record<string, unknown> = {
    ...extraFields,
  };

  if (input.collection === "authors") {
    const name = readNonEmptyString(fields.name);
    if (name) body.name = name;
    const slug = readNonEmptyString(fields.slug);
    if (slug) body.slug = slug;
    const bio = readNonEmptyString(fields.bio);
    if (bio) body.bio = bio;
    const roleTitle = readNonEmptyString(fields.roleTitle);
    if (roleTitle) body.roleTitle = roleTitle;
    if (fields.photo !== undefined && fields.photo !== null && String(fields.photo).trim().length > 0) {
      body.photo = fields.photo;
    }
    if (Array.isArray(fields.socialLinks)) {
      body.socialLinks = fields.socialLinks;
    }
  } else {
    const title = readNonEmptyString(fields.title);
    if (title) body.title = title;
    const slug = readNonEmptyString(fields.slug);
    if (slug) body.slug = slug;
    const description = readNonEmptyString(fields.description);
    if (description) body.description = description;
    const seoTitle = readNonEmptyString(fields.seoTitle);
    if (seoTitle) body.seoTitle = seoTitle;
    const seoDescription = readNonEmptyString(fields.seoDescription);
    if (seoDescription) body.seoDescription = seoDescription;
  }

  if (Object.keys(body).length === 0) {
    throw new Error("Payload taxonomy update produced an empty patch body");
  }

  const targetId = String(target.id ?? "").trim();
  if (!targetId) throw new Error("Payload taxonomy update target is missing id");

  const data = await payloadRequest<unknown>({
    ...input,
    method: "PATCH",
    pathname: `/${taxonomyCollection(input.config, input.collection)}/${encodeURIComponent(targetId)}`,
    body,
  });

  return {
    content: `Updated Payload CMS ${input.collection} term. ${summarizeDoc(data)}`,
    data: {
      before: target,
      after: data,
      updated: true,
    },
  };
}

export async function deleteTaxonomyTerm(input: PayloadCmsDeleteTaxonomyTermInput) {
  if (!["categories", "tags"].includes(input.collection)) {
    throw new Error("Payload taxonomy deletion is supported only for categories and tags");
  }
  if (input.confirmDeleteTaxonomyTerm !== true) {
    throw new Error("Payload taxonomy deletion requires confirmDeleteTaxonomyTerm=true");
  }
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("Payload taxonomy term id is required");

  const collection = taxonomyCollection(input.config, input.collection);
  const doc = await payloadRequest<Record<string, unknown>>({
    ...input,
    pathname: `/${collection}/${encodeURIComponent(id)}`,
    query: { depth: 0 },
  });

  const expectedSlug = readNonEmptyString(input.expectedSlug);
  if (expectedSlug && doc.slug !== expectedSlug) {
    throw new Error(`Refusing taxonomy deletion: expected slug ${expectedSlug}, got ${String(doc.slug ?? "")}`);
  }

  const expectedTitle = readNonEmptyString(input.expectedTitle);
  const titleField = taxonomyTitleField(input.collection);
  if (expectedTitle && doc[titleField] !== expectedTitle) {
    throw new Error(
      `Refusing taxonomy deletion: expected ${titleField} ${expectedTitle}, got ${String(doc[titleField] ?? "")}`,
    );
  }

  if (input.collection === "categories") {
    const linkedPosts = await payloadRequest<{ totalDocs?: number; docs?: unknown[] }>({
      ...input,
      pathname: `/${blogPostsCollection(input.config)}`,
      query: {
        limit: 1,
        depth: 0,
        "where[category][equals]": id,
      },
    });
    const linkedCount = typeof linkedPosts.totalDocs === "number"
      ? linkedPosts.totalDocs
      : Array.isArray(linkedPosts.docs)
        ? linkedPosts.docs.length
        : 0;
    if (linkedCount > 0) {
      throw new Error(`Refusing taxonomy deletion: category ${id} is linked to ${linkedCount} blog post(s)`);
    }
  }

  const data = await payloadRequest<unknown>({
    ...input,
    method: "DELETE",
    pathname: `/${collection}/${encodeURIComponent(id)}`,
  });
  return {
    content: `Deleted Payload CMS ${input.collection} term: ${summarizeDoc(doc)}`,
    data: {
      deleted: true,
      deletedDoc: doc,
      response: data,
    },
  };
}

export async function ensureAuthor(input: PayloadCmsEnsureAuthorInput) {
  const name = readNonEmptyString(input.name);
  if (!name) throw new Error("Payload author name is required");

  const explicitSlug = readNonEmptyString(input.slug);
  const slug = explicitSlug ?? slugifyAuthor(name);
  const existingBySlug = await findTaxonomyTerm({
    ...input,
    collection: "authors",
    slug,
    limit: 1,
    depth: 0,
  });
  const existingBySlugDoc = (existingBySlug.data as { doc?: unknown }).doc;
  const existingByName = existingBySlugDoc
    ? null
    : await findTaxonomyTerm({
        ...input,
        collection: "authors",
        title: name,
        limit: 1,
        depth: 0,
      });
  const existingDoc = existingBySlugDoc ?? (existingByName?.data as { doc?: unknown } | undefined)?.doc;
  if (existingDoc) {
    return {
      content: `Payload CMS author already exists. ${summarizeDoc(existingDoc)}`,
      data: {
        doc: existingDoc,
        created: false,
      },
    };
  }

  const extraFields = input.extraFields ?? {};
  if (
    Object.prototype.hasOwnProperty.call(extraFields, "id") ||
    Object.prototype.hasOwnProperty.call(extraFields, "createdAt") ||
    Object.prototype.hasOwnProperty.call(extraFields, "updatedAt")
  ) {
    throw new Error("Author extraFields must not override system fields");
  }

  const body: Record<string, unknown> = {
    ...extraFields,
    name,
    slug,
    ...(readNonEmptyString(input.bio) ? { bio: input.bio?.trim() } : {}),
    ...(readNonEmptyString(input.roleTitle) ? { roleTitle: input.roleTitle?.trim() } : {}),
    ...(input.photo !== undefined && input.photo !== null && String(input.photo).trim().length > 0 ? { photo: input.photo } : {}),
    ...(readNonEmptyString(input.expertUrl)
      ? { socialLinks: [{ label: "Профіль експерта Astrogen", url: input.expertUrl?.trim() }] }
      : {}),
  };
  const data = await payloadRequest<unknown>({
    ...input,
    method: "POST",
    pathname: `/${taxonomyCollection(input.config, "authors")}`,
    body,
  });
  return {
    content: `Payload CMS author created. ${summarizeDoc(data)}`,
    data: {
      doc: data,
      created: true,
    },
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

export function buildUniqueUploadFilename(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const rawBase = path.basename(filePath, ext);
  const safeBase = rawBase
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 72) || "payload-media";
  const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  return `${safeBase}-${suffix}${ext || ".bin"}`;
}

export async function uploadMedia(input: PayloadCmsUploadMediaInput) {
  const fileBytes = await readFile(input.filePath);
  const form = new FormData();
  const filename = buildUniqueUploadFilename(input.filePath);
  const file = typeof File === "function"
    ? new File([fileBytes], filename, { type: mimeTypeForFile(input.filePath) })
    : new Blob([fileBytes], { type: mimeTypeForFile(input.filePath) });
  form.append("file", file, filename);
  form.append("_payload", JSON.stringify({
    alt: input.alt,
    ...(readNonEmptyString(input.caption) ? { caption: input.caption?.trim() } : {}),
    ...(readNonEmptyString(input.credit) ? { credit: input.credit?.trim() } : {}),
    ...(readNonEmptyString(input.sourceUrl) ? { sourceUrl: input.sourceUrl?.trim() } : {}),
  }));

  const data = await payloadMultipartRequest<unknown>({
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

async function resolveBlogPostFields(input: PayloadCmsRequestInput & BlogPostFields) {
  const fields: BlogPostFields = { ...input };
  if (fields.category === undefined || fields.category === null || String(fields.category).trim().length === 0) {
    const categorySlug = readNonEmptyString(fields.categorySlug);
    const categoryTitle = readNonEmptyString(fields.categoryTitle);
    if (categorySlug || categoryTitle) {
      const term = fields.ensureCategory
        ? await ensureTaxonomyTerm({
            ...input,
            collection: "categories",
            title: categoryTitle ?? categorySlug ?? "",
            slug: categorySlug ?? undefined,
          })
        : await findTaxonomyTerm({
            ...input,
            collection: "categories",
            slug: categorySlug ?? undefined,
            title: categoryTitle ?? undefined,
          });
      const doc = (term.data as { doc?: { id?: unknown } }).doc;
      if (!doc?.id) {
        throw new Error(
          `Payload CMS category was not found for ${categorySlug ? `slug ${categorySlug}` : `title ${categoryTitle}`}; pass ensureCategory=true to create it when allowed`,
        );
      }
      fields.category = doc.id as string | number;
    }
  }
  delete fields.categorySlug;
  delete fields.categoryTitle;
  delete fields.ensureCategory;
  return fields;
}

export async function createBlogPostDraft(
  input: PayloadCmsRequestInput & BlogPostFields,
) {
  const fields = await resolveBlogPostFields(input);
  const data = await payloadRequest<unknown>({
    ...input,
    method: "POST",
    pathname: `/${blogPostsCollection(input.config)}`,
    body: buildBlogPostPayload(fields),
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
    body: buildBlogPostPayload(await resolveBlogPostFields({
      config: input.config,
      resolveSecret: input.resolveSecret,
      fetchFn: input.fetchFn,
      ...input.fields,
    })),
  });
  return {
    content: summarizeDoc(data),
    data,
  };
}

export async function cleanupTechnicalBlogPostDraft(
  input: PayloadCmsCleanupTechnicalBlogPostDraftInput,
) {
  if (input.confirmTechnicalDraftCleanup !== true) {
    throw new Error("Technical blog draft cleanup requires confirmTechnicalDraftCleanup=true");
  }

  const found = await findBlogPost({
    ...input,
    id: input.id,
    slug: input.slug,
    draft: true,
    depth: 0,
  });
  const doc = input.id !== undefined && input.id !== null
    ? found.data
    : (found.data as { doc?: unknown }).doc;
  if (!doc || typeof doc !== "object") {
    throw new Error("Payload blog post was not found for technical draft cleanup");
  }

  const record = doc as Record<string, unknown>;
  const id = record.id;
  if (id === undefined || id === null || String(id).trim().length === 0) {
    throw new Error("Payload blog post id is required for technical draft cleanup");
  }

  const expectedSlug = readNonEmptyString(input.expectedSlug);
  if (expectedSlug && record.slug !== expectedSlug) {
    throw new Error(`Refusing cleanup: expected slug ${expectedSlug}, got ${String(record.slug ?? "")}`);
  }

  const expectedTitle = readNonEmptyString(input.expectedTitle);
  if (expectedTitle && record.title !== expectedTitle) {
    throw new Error(`Refusing cleanup: expected title ${expectedTitle}, got ${String(record.title ?? "")}`);
  }

  if (isPublishedOrApprovedBlogPost(record)) {
    throw new Error("Refusing cleanup: published, approved, or previously published blog posts cannot be deleted");
  }

  if (!isTechnicalDraftCandidate(record)) {
    throw new Error("Refusing cleanup: blog post does not look like a technical smoke/test draft");
  }

  const data = await payloadRequest<unknown>({
    ...input,
    method: "DELETE",
    pathname: `/${blogPostsCollection(input.config)}/${encodeURIComponent(String(id))}`,
    query: { draft: true },
  });
  return {
    content: `Deleted technical Payload CMS blog draft: ${summarizeDoc(record)}`,
    data: {
      deleted: true,
      deletedDoc: record,
      response: data,
    },
  };
}

export async function publishBlogPost(
  input: PayloadCmsRequestInput & {
    id?: number | string;
    slug?: string;
    confirmPublish?: boolean;
    publishedAt?: string;
    fields?: BlogPostFields;
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
    body: buildBlogPostPayload(
      {
        ...(input.fields ?? {}),
        publishedAt: input.publishedAt ?? input.fields?.publishedAt,
      },
      { publish: true },
    ),
  });
  return {
    content: summarizeDoc(data),
    data,
  };
}
