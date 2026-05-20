import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_AUTHORS_COLLECTION,
  DEFAULT_BLOG_POSTS_COLLECTION,
  DEFAULT_BUILD_STATE_GLOBAL,
  DEFAULT_CATEGORIES_COLLECTION,
  DEFAULT_MEDIA_COLLECTION,
  DEFAULT_PAYLOAD_API_BASE_URL,
  DEFAULT_TAGS_COLLECTION,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
} from "./constants.js";

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const blogPostFieldsSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    excerpt: { type: "string" },
    markdown: { type: "string" },
    content: looseObjectSchema,
    coverImage: { type: ["number", "string"] },
    ogImage: { type: ["number", "string"] },
    author: { type: ["number", "string"] },
    category: { type: ["number", "string"] },
    tags: {
      type: "array",
      items: { type: ["number", "string"] },
    },
    relatedPosts: {
      type: "array",
      items: { type: ["number", "string"] },
    },
    workflowStatus: { type: "string" },
    publishedAt: { type: "string" },
    scheduledPublishAt: { type: "string" },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    canonicalUrl: { type: "string" },
    noindex: { type: "boolean" },
    extraFields: looseObjectSchema,
  },
  additionalProperties: false,
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Payload CMS Agent Tools",
  description:
    "Server-side Payload CMS connector for Astrogen-style blog draft creation, media upload, guarded publishing, and CMS state checks.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      payloadApiKeySecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Payload API Key Secret Ref",
        description:
          "Paperclip secret UUID containing the Payload users API key. Agents never receive the plaintext key.",
        default: "",
      },
      payloadApiBaseUrl: {
        type: "string",
        title: "Payload API Base URL",
        description: "Base URL for Payload REST API.",
        default: DEFAULT_PAYLOAD_API_BASE_URL,
      },
      authCollectionSlug: {
        type: "string",
        title: "Auth Collection Slug",
        default: "users",
      },
      blogPostsCollectionSlug: {
        type: "string",
        title: "Blog Posts Collection Slug",
        default: DEFAULT_BLOG_POSTS_COLLECTION,
      },
      mediaCollectionSlug: {
        type: "string",
        title: "Media Collection Slug",
        default: DEFAULT_MEDIA_COLLECTION,
      },
      categoriesCollectionSlug: {
        type: "string",
        title: "Categories Collection Slug",
        default: DEFAULT_CATEGORIES_COLLECTION,
      },
      tagsCollectionSlug: {
        type: "string",
        title: "Tags Collection Slug",
        default: DEFAULT_TAGS_COLLECTION,
      },
      authorsCollectionSlug: {
        type: "string",
        title: "Authors Collection Slug",
        default: DEFAULT_AUTHORS_COLLECTION,
      },
      buildStateGlobalSlug: {
        type: "string",
        title: "Build State Global Slug",
        default: DEFAULT_BUILD_STATE_GLOBAL,
      },
      requestTimeoutMs: {
        type: "number",
        title: "Request Timeout Ms",
        default: 60000,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Payload CMS Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.healthCheck,
      displayName: "Payload CMS Health Check",
      description:
        "Verify Payload CMS API connectivity, API-key authorization, build state read access, and visible collection permissions.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getBuildState,
      displayName: "Payload CMS Get Build State",
      description: "Read the configured Payload build-state global.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getAccess,
      displayName: "Payload CMS Get Access",
      description: "Read Payload access metadata for the configured service user.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.findBlogPost,
      displayName: "Payload CMS Find Blog Post",
      description: "Find a blog post by id or slug without exposing the API key to agents.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: ["number", "string"] },
          slug: { type: "string" },
          depth: { type: "number" },
          draft: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.listTaxonomy,
      displayName: "Payload CMS List Taxonomy",
      description: "List categories, tags, or authors in Payload CMS.",
      parametersSchema: {
        type: "object",
        properties: {
          collection: { type: "string", enum: ["categories", "tags", "authors"] },
          limit: { type: "number" },
          depth: { type: "number" },
        },
        required: ["collection"],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.uploadMedia,
      displayName: "Payload CMS Upload Media",
      description:
        "Upload a local image/file to the configured Payload media collection. Use for article cover images before creating/updating drafts.",
      parametersSchema: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          alt: { type: "string" },
          caption: { type: "string" },
          credit: { type: "string" },
          sourceUrl: { type: "string" },
        },
        required: ["filePath", "alt"],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.createBlogPostDraft,
      displayName: "Payload CMS Create Blog Post Draft",
      description:
        "Create a Payload blog post draft. Defaults to `_status=draft`; use publish tool separately for live publication.",
      parametersSchema: blogPostFieldsSchema,
    },
    {
      name: TOOL_NAMES.updateBlogPostDraft,
      displayName: "Payload CMS Update Blog Post Draft",
      description:
        "Update an existing Payload blog post as a draft/revision by id or slug. Does not publish unless the publish tool is called separately.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: ["number", "string"] },
          slug: { type: "string" },
          fields: blogPostFieldsSchema,
        },
        required: ["fields"],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.publishBlogPost,
      displayName: "Payload CMS Publish Blog Post",
      description:
        "Publish an existing Payload blog post. Requires `confirmPublish=true`; agents should call this only after explicit human approval.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: ["number", "string"] },
          slug: { type: "string" },
          confirmPublish: { type: "boolean" },
          publishedAt: { type: "string" },
        },
        required: ["confirmPublish"],
        additionalProperties: false,
      },
    },
  ],
};

export default manifest;
