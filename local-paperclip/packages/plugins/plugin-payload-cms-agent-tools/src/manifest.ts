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

const iconListIcons = [
  "chinese-rat",
  "chinese-ox",
  "chinese-tiger",
  "chinese-rabbit",
  "chinese-dragon",
  "chinese-snake",
  "chinese-horse",
  "chinese-goat",
  "chinese-monkey",
  "chinese-rooster",
  "chinese-dog",
  "chinese-pig",
  "zodiac-aries",
  "zodiac-taurus",
  "zodiac-gemini",
  "zodiac-cancer",
  "zodiac-leo",
  "zodiac-virgo",
  "zodiac-libra",
  "zodiac-scorpio",
  "zodiac-sagittarius",
  "zodiac-capricorn",
  "zodiac-aquarius",
  "zodiac-pisces",
  "editorial-check",
  "editorial-info",
  "editorial-calendar",
  "editorial-money",
  "editorial-heart",
  "editorial-star",
  "editorial-people",
  "editorial-chat",
  "editorial-target",
  "editorial-book",
] as const;

const articleContentSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: ["articleContent.v1"] },
    blocks: {
      type: "array",
      minItems: 1,
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["paragraph"] },
              text: { type: "string" },
            },
            required: ["type", "text"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["heading"] },
              level: { type: "string", enum: ["h2", "h3", "h4"] },
              text: { type: "string" },
            },
            required: ["type", "level", "text"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["list"] },
              ordered: { type: "boolean" },
              items: { type: "array", minItems: 1, items: { type: "string" } },
            },
            required: ["type", "ordered", "items"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["editorialCallout"] },
              variant: { type: "string", enum: ["soft", "brand", "situation"] },
              title: { type: "string" },
              body: { type: "string" },
            },
            required: ["type", "variant", "title", "body"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["iconList"] },
              style: { type: "string", enum: ["grid", "compact", "twoColumn"] },
              title: { type: "string" },
              items: {
                type: "array",
                minItems: 1,
                maxItems: 40,
                items: {
                  type: "object",
                  properties: {
                    icon: { type: "string", enum: iconListIcons },
                    label: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["icon", "label"],
                  additionalProperties: false,
                },
              },
            },
            required: ["type", "style", "title", "items"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["twoColumnText"] },
              mode: { type: "string", enum: ["text"] },
              leftTitle: { type: "string" },
              leftBody: { type: "string" },
              rightTitle: { type: "string" },
              rightBody: { type: "string" },
            },
            required: ["type", "mode", "leftTitle", "leftBody", "rightTitle", "rightBody"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["twoColumnText"] },
              mode: { type: "string", enum: ["list"] },
              leftTitle: { type: "string" },
              leftBody: { type: "array", minItems: 1, items: { type: "string" } },
              rightTitle: { type: "string" },
              rightBody: { type: "array", minItems: 1, items: { type: "string" } },
            },
            required: ["type", "mode", "leftTitle", "leftBody", "rightTitle", "rightBody"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["quietCta"] },
              title: { type: "string" },
              text: { type: "string" },
              linkLabel: { type: "string" },
              linkUrl: { type: "string" },
              note: { type: "string" },
            },
            required: ["type", "title", "text", "linkLabel", "linkUrl"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["schemaVersion", "blocks"],
  additionalProperties: false,
} as const;

const blogPostFieldsSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    excerpt: { type: "string" },
    articleContent: articleContentSchema,
    coverImage: { type: ["number", "string"] },
    ogImage: { type: ["number", "string"] },
    author: { type: ["number", "string"] },
    category: { type: ["number", "string"] },
    categorySlug: { type: "string" },
    categoryTitle: { type: "string" },
    ensureCategory: { type: "boolean" },
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
      name: TOOL_NAMES.listBlogPosts,
      displayName: "Payload CMS List Blog Posts",
      description:
        "List/count Payload blog posts for publishing reports. Use CMS state instead of sitemap counts when reporting published articles or ready drafts.",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["published", "draft", "any"] },
          workflowStatus: { type: "string" },
          publishedFrom: { type: "string" },
          publishedTo: { type: "string" },
          updatedFrom: { type: "string" },
          updatedTo: { type: "string" },
          limit: { type: "number" },
          page: { type: "number" },
          depth: { type: "number" },
          sort: { type: "string" },
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
      name: TOOL_NAMES.ensureTaxonomyTerm,
      displayName: "Payload CMS Ensure Taxonomy Term",
      description:
        "Find or create a Payload category/tag by slug and title. Use before blog draft creation when a newly approved product route has no CMS category yet.",
      parametersSchema: {
        type: "object",
        properties: {
          collection: { type: "string", enum: ["categories", "tags"] },
          title: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
        },
        required: ["collection", "title"],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.ensureAuthor,
      displayName: "Payload CMS Ensure Author",
      description:
        "Find or create a Payload blog author by slug/name. Use before CMS draft creation when an owner-provided article must keep a specific expert author.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          slug: { type: "string" },
          expertUrl: { type: "string" },
          bio: { type: "string" },
          roleTitle: { type: "string" },
          photo: { type: ["number", "string"] },
          extraFields: looseObjectSchema,
        },
        required: ["name"],
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
        "Create a Payload blog post draft with articleContent.v1. Defaults to `_status=draft`; use publish tool separately for live publication.",
      parametersSchema: blogPostFieldsSchema,
    },
    {
      name: TOOL_NAMES.updateBlogPostDraft,
      displayName: "Payload CMS Update Blog Post Draft",
      description:
        "Update an existing Payload blog post as a draft/revision by id or slug using articleContent.v1. Does not publish unless the publish tool is called separately.",
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
