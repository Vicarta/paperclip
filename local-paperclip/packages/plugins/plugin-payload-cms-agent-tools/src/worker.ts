import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import path from "node:path";
import { PLUGIN_ID, TOOL_NAMES } from "./constants.js";
import { blogPostFieldsSchema, updateBlogPostDraftParametersSchema } from "./schemas.js";
import {
  createBlogPostDraft,
  cleanupTechnicalBlogPostDraft,
  deleteTaxonomyTerm,
  ensureAuthor,
  findBlogPost,
  getAccess,
  getBuildState,
  healthCheck,
  ensureTaxonomyTerm,
  listBlogPosts,
  listTaxonomy,
  publishBlogPost,
  type PayloadCmsPluginConfig,
  updateMedia,
  updateTaxonomyTerm,
  updateBlogPostDraft,
  uploadMedia,
} from "./payload-cms-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

function readObjectParams(params: unknown) {
  return params && typeof params === "object" && !Array.isArray(params)
    ? params as Record<string, unknown>
    : {};
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveWorkspaceFilePath(filePath: string, runCtx: unknown) {
  const trimmed = filePath.trim();
  if (path.isAbsolute(trimmed)) return trimmed;

  const context = readObjectParams(runCtx);
  const workspaceCwd = readNonEmptyString(context.executionWorkspaceCwd) ??
    readNonEmptyString(context.workspaceCwd);
  if (!workspaceCwd) return trimmed;

  const base = path.resolve(workspaceCwd);
  const resolved = path.resolve(base, trimmed);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error("Payload media filePath must stay within the execution workspace");
  }
  return resolved;
}

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as PayloadCmsPluginConfig;
}

async function withClientConfig<T>(
  ctx: PluginSetupContext,
  fn: (base: {
    config: PayloadCmsPluginConfig;
    resolveSecret: (secretRef: string) => Promise<string>;
    fetchFn: typeof fetch;
  }) => Promise<T>,
) {
  const config = await getConfig(ctx);
  return await fn({
    config,
    resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
    fetchFn: ctx.http.fetch as typeof fetch,
  });
}

function toolResult(result: { content: string; data: unknown }): ToolResult {
  return {
    content: result.content,
    data: result.data,
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.healthCheck,
      {
        displayName: "Payload CMS Health Check",
        description:
          "Verify Payload CMS API connectivity, API-key authorization, build state read access, and visible collection permissions.",
        parametersSchema: { type: "object", additionalProperties: true },
      },
      async (): Promise<ToolResult> =>
        toolResult(await withClientConfig(ctx, (base) => healthCheck(base))),
    );

    ctx.tools.register(
      TOOL_NAMES.getBuildState,
      {
        displayName: "Payload CMS Get Build State",
        description: "Read the configured Payload build-state global.",
        parametersSchema: { type: "object", additionalProperties: true },
      },
      async (): Promise<ToolResult> =>
        toolResult(await withClientConfig(ctx, (base) => getBuildState(base))),
    );

    ctx.tools.register(
      TOOL_NAMES.getAccess,
      {
        displayName: "Payload CMS Get Access",
        description: "Read Payload access metadata for the configured service user.",
        parametersSchema: { type: "object", additionalProperties: true },
      },
      async (): Promise<ToolResult> =>
        toolResult(await withClientConfig(ctx, (base) => getAccess(base))),
    );

    ctx.tools.register(
      TOOL_NAMES.findBlogPost,
      {
        displayName: "Payload CMS Find Blog Post",
        description: "Find a blog post by id or slug.",
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
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        return toolResult(await withClientConfig(ctx, (base) =>
          findBlogPost({
            ...base,
            id: typed.id as string | number | undefined,
            slug: typed.slug as string | undefined,
            depth: typed.depth as number | undefined,
            draft: typed.draft as boolean | undefined,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.listBlogPosts,
      {
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
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        return toolResult(await withClientConfig(ctx, (base) =>
          listBlogPosts({
            ...base,
            status: typed.status as "published" | "draft" | "any" | undefined,
            workflowStatus: typed.workflowStatus as string | undefined,
            publishedFrom: typed.publishedFrom as string | undefined,
            publishedTo: typed.publishedTo as string | undefined,
            updatedFrom: typed.updatedFrom as string | undefined,
            updatedTo: typed.updatedTo as string | undefined,
            limit: typed.limit as number | undefined,
            page: typed.page as number | undefined,
            depth: typed.depth as number | undefined,
            sort: typed.sort as string | undefined,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.listTaxonomy,
      {
        displayName: "Payload CMS List Taxonomy",
        description: "List categories, tags, or authors.",
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
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typeof typed.collection !== "string") {
          throw new Error("Payload taxonomy collection is required");
        }
        const collection = typed.collection;
        return toolResult(await withClientConfig(ctx, (base) =>
          listTaxonomy({
            ...base,
            collection,
            limit: typed.limit as number | undefined,
            depth: typed.depth as number | undefined,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.ensureTaxonomyTerm,
      {
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
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typeof typed.collection !== "string") {
          throw new Error("Payload taxonomy collection is required");
        }
        if (typeof typed.title !== "string" || typed.title.trim().length === 0) {
          throw new Error("Payload taxonomy title is required");
        }
        const collection = typed.collection;
        const title = typed.title;
        return toolResult(await withClientConfig(ctx, (base) =>
          ensureTaxonomyTerm({
            ...base,
            collection,
            title,
            slug: typed.slug as string | undefined,
            description: typed.description as string | undefined,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.updateTaxonomyTerm,
      {
        displayName: "Payload CMS Update Taxonomy Term",
        description:
          "Patch a category/tag/author term after deterministic verification. Use for category SEO metadata, slug normalization, or orphan-term neutralization when delete is not allowed.",
        parametersSchema: {
          type: "object",
          properties: {
            collection: { type: "string", enum: ["categories", "tags", "authors"] },
            id: { type: ["number", "string"] },
            slug: { type: "string" },
            expectedSlug: { type: "string" },
            expectedTitle: { type: "string" },
            fields: {
              type: "object",
              properties: {
                title: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
                description: { type: "string" },
                seoTitle: { type: "string" },
                seoDescription: { type: "string" },
                bio: { type: "string" },
                roleTitle: { type: "string" },
                photo: { type: ["number", "string"] },
                socialLinks: {
                  type: "array",
                  items: { type: "object", additionalProperties: true },
                },
                extraFields: { type: "object", additionalProperties: true },
              },
              additionalProperties: false,
            },
          },
          required: ["collection", "fields"],
          additionalProperties: false,
        },
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typeof typed.collection !== "string") {
          throw new Error("Payload taxonomy collection is required");
        }
        const collection = typed.collection;
        return toolResult(await withClientConfig(ctx, (base) =>
          updateTaxonomyTerm({
            ...base,
            collection,
            id: typed.id as string | number | undefined,
            slug: typed.slug as string | undefined,
            expectedSlug: typed.expectedSlug as string | undefined,
            expectedTitle: typed.expectedTitle as string | undefined,
            fields: {
              ...readObjectParams(typed.fields),
              extraFields: readObjectParams(readObjectParams(typed.fields).extraFields),
            },
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.deleteTaxonomyTerm,
      {
        displayName: "Payload CMS Delete Taxonomy Term",
        description:
          "Delete an orphan Payload category/tag only after deterministic verification. Refuses category deletion when blog posts still reference it.",
        parametersSchema: {
          type: "object",
          properties: {
            collection: { type: "string", enum: ["categories", "tags"] },
            id: { type: ["number", "string"] },
            expectedSlug: { type: "string" },
            expectedTitle: { type: "string" },
            confirmDeleteTaxonomyTerm: { type: "boolean" },
          },
          required: ["collection", "id", "confirmDeleteTaxonomyTerm"],
          additionalProperties: false,
        },
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typeof typed.collection !== "string") {
          throw new Error("Payload taxonomy collection is required");
        }
        if (typed.id === undefined || typed.id === null || String(typed.id).trim().length === 0) {
          throw new Error("Payload taxonomy term id is required");
        }
        const collection = typed.collection;
        return toolResult(await withClientConfig(ctx, (base) =>
          deleteTaxonomyTerm({
            ...base,
            collection,
            id: typed.id as string | number,
            expectedSlug: typed.expectedSlug as string | undefined,
            expectedTitle: typed.expectedTitle as string | undefined,
            confirmDeleteTaxonomyTerm: typed.confirmDeleteTaxonomyTerm as boolean | undefined,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.ensureAuthor,
      {
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
            extraFields: { type: "object", additionalProperties: true },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typeof typed.name !== "string" || typed.name.trim().length === 0) {
          throw new Error("Payload author name is required");
        }
        return toolResult(await withClientConfig(ctx, (base) =>
          ensureAuthor({
            ...base,
            name: typed.name as string,
            slug: typed.slug as string | undefined,
            expertUrl: typed.expertUrl as string | undefined,
            bio: typed.bio as string | undefined,
            roleTitle: typed.roleTitle as string | undefined,
            photo: typed.photo as string | number | undefined,
            extraFields: readObjectParams(typed.extraFields),
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.uploadMedia,
      {
        displayName: "Payload CMS Upload Media",
        description:
          "Upload a local file to the configured Payload media collection. The plugin sends a unique filename to prevent Payload responsive-image filename collisions.",
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
      async (params, runCtx): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typeof typed.filePath !== "string" || typed.filePath.trim().length === 0) {
          throw new Error("Payload media filePath is required");
        }
        if (typeof typed.alt !== "string" || typed.alt.trim().length === 0) {
          throw new Error("Payload media alt text is required");
        }
        const filePath = resolveWorkspaceFilePath(typed.filePath, runCtx);
        const alt = typed.alt;
        return toolResult(await withClientConfig(ctx, (base) =>
          uploadMedia({
            ...base,
            filePath,
            alt,
            caption: typed.caption as string | undefined,
            credit: typed.credit as string | undefined,
            sourceUrl: typed.sourceUrl as string | undefined,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.updateMedia,
      {
        displayName: "Payload CMS Update Media",
        description:
          "Patch an existing Payload media record by id. Use to repair cover/OG alt text or clear caption/credit/sourceUrl without uploading a duplicate image.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: ["number", "string"] },
            alt: { type: "string" },
            caption: { type: ["string", "null"] },
            credit: { type: ["string", "null"] },
            sourceUrl: { type: ["string", "null"] },
            fields: { type: "object", additionalProperties: true },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typed.id === undefined || typed.id === null || String(typed.id).trim().length === 0) {
          throw new Error("Payload media id is required");
        }
        return toolResult(await withClientConfig(ctx, (base) =>
          updateMedia({
            ...base,
            id: typed.id as string | number,
            alt: typed.alt as string | undefined,
            caption: typed.caption as string | null | undefined,
            credit: typed.credit as string | null | undefined,
            sourceUrl: typed.sourceUrl as string | null | undefined,
            fields: readObjectParams(typed.fields),
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.createBlogPostDraft,
      {
        displayName: "Payload CMS Create Blog Post Draft",
        description:
          "Create a Payload blog post draft. Use canonical articleContent.v1 blocks; do not publish or send legacy articleContent aliases.",
        parametersSchema: blogPostFieldsSchema,
      },
      async (params): Promise<ToolResult> =>
        toolResult(await withClientConfig(ctx, (base) =>
          createBlogPostDraft({ ...base, ...readObjectParams(params) }),
        )),
    );

    ctx.tools.register(
      TOOL_NAMES.updateBlogPostDraft,
      {
        displayName: "Payload CMS Update Blog Post Draft",
        description:
          "Update an existing Payload blog post as a draft/revision by id or slug. fields.articleContent must be canonical articleContent.v1 blocks.",
        parametersSchema: updateBlogPostDraftParametersSchema,
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        const fields = readObjectParams(typed.fields);
        return toolResult(await withClientConfig(ctx, (base) =>
          updateBlogPostDraft({
            ...base,
            id: typed.id as string | number | undefined,
            slug: typed.slug as string | undefined,
            fields,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.cleanupTechnicalBlogPostDraft,
      {
        displayName: "Payload CMS Cleanup Technical Blog Post Draft",
        description:
          "Delete an unpublished technical smoke/test blog draft only after strict guard checks. Never use for editorial content.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: ["number", "string"] },
            slug: { type: "string" },
            expectedSlug: { type: "string" },
            expectedTitle: { type: "string" },
            confirmTechnicalDraftCleanup: { type: "boolean" },
          },
          required: ["confirmTechnicalDraftCleanup"],
          additionalProperties: false,
        },
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        return toolResult(await withClientConfig(ctx, (base) =>
          cleanupTechnicalBlogPostDraft({
            ...base,
            id: typed.id as string | number | undefined,
            slug: typed.slug as string | undefined,
            expectedSlug: typed.expectedSlug as string | undefined,
            expectedTitle: typed.expectedTitle as string | undefined,
            confirmTechnicalDraftCleanup: typed.confirmTechnicalDraftCleanup as boolean | undefined,
          }),
        ));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.publishBlogPost,
      {
        displayName: "Payload CMS Publish Blog Post",
        description:
          "Publish an existing Payload blog post. Requires confirmPublish=true after explicit human approval.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: ["number", "string"] },
            slug: { type: "string" },
            confirmPublish: { type: "boolean" },
            publishedAt: { type: "string" },
            fields: { type: "object", additionalProperties: true },
          },
          required: ["confirmPublish"],
          additionalProperties: false,
        },
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        return toolResult(await withClientConfig(ctx, (base) =>
          publishBlogPost({
            ...base,
            id: typed.id as string | number | undefined,
            slug: typed.slug as string | undefined,
            confirmPublish: typed.confirmPublish as boolean | undefined,
            publishedAt: typed.publishedAt as string | undefined,
            fields: readObjectParams(typed.fields),
          }),
        ));
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
