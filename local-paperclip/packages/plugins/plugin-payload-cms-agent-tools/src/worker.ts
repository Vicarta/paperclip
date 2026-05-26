import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID, TOOL_NAMES } from "./constants.js";
import {
  createBlogPostDraft,
  findBlogPost,
  getAccess,
  getBuildState,
  healthCheck,
  listBlogPosts,
  listTaxonomy,
  publishBlogPost,
  type PayloadCmsPluginConfig,
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
      TOOL_NAMES.uploadMedia,
      {
        displayName: "Payload CMS Upload Media",
        description: "Upload a local file to the configured Payload media collection.",
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
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params);
        if (typeof typed.filePath !== "string" || typed.filePath.trim().length === 0) {
          throw new Error("Payload media filePath is required");
        }
        if (typeof typed.alt !== "string" || typed.alt.trim().length === 0) {
          throw new Error("Payload media alt text is required");
        }
        const filePath = typed.filePath;
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
      TOOL_NAMES.createBlogPostDraft,
      {
        displayName: "Payload CMS Create Blog Post Draft",
        description: "Create a Payload blog post draft.",
        parametersSchema: { type: "object", additionalProperties: true },
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
        description: "Update an existing Payload blog post as a draft/revision by id or slug.",
        parametersSchema: { type: "object", additionalProperties: true },
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
