import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID, TOOL_NAMES } from "./constants.js";
import {
  batchUpdate,
  createDocFromHtml,
  exportDoc,
  getDoc,
  healthCheck,
  replaceAllText,
  shareDoc,
  type GoogleDriveDocsPluginConfig,
} from "./google-drive-docs-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

async function getConfig(ctx: PluginSetupContext): Promise<GoogleDriveDocsPluginConfig> {
  return (await ctx.config.get()) as GoogleDriveDocsPluginConfig;
}

async function callGoogleTool(
  ctx: PluginSetupContext,
  fn: (
    deps: {
      config: GoogleDriveDocsPluginConfig;
      resolveSecret: (secretRef: string) => Promise<string>;
      fetchFn: typeof fetch;
    },
    params: unknown,
  ) => Promise<Record<string, unknown>>,
  params: unknown,
): Promise<ToolResult> {
  const config = await getConfig(ctx);
  const data = await fn(
    {
      config,
      resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
      fetchFn: ctx.http.fetch as unknown as typeof fetch,
    },
    params,
  );
  return {
    content: JSON.stringify(data, null, 2),
    data,
  };
}

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} setup complete`);

    ctx.tools.register(
      TOOL_NAMES.healthCheck,
      {
        displayName: "Google Drive Docs Health Check",
        description: "Verify service-account access to Google Drive without exposing secrets.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> =>
        await callGoogleTool(ctx, async (deps) => await healthCheck(deps), {}),
    );

    ctx.tools.register(
      TOOL_NAMES.createDocFromHtml,
      {
        displayName: "Create Google Doc From HTML",
        description:
          "Import safe HTML into a Google Docs document in an allowed Drive folder.",
        parametersSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            html: { type: "string" },
            folderId: { type: "string" },
          },
          required: ["title", "html"],
          additionalProperties: false,
        },
      },
      async (params): Promise<ToolResult> =>
        await callGoogleTool(ctx, createDocFromHtml, params),
    );

    ctx.tools.register(
      TOOL_NAMES.getDoc,
      {
        displayName: "Get Google Doc Metadata",
        description: "Read Google Drive metadata for a Docs document.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => await callGoogleTool(ctx, getDoc, params),
    );

    ctx.tools.register(
      TOOL_NAMES.shareDoc,
      {
        displayName: "Share Google Doc",
        description: "Apply a controlled Drive permission to a Google Doc.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => await callGoogleTool(ctx, shareDoc, params),
    );

    ctx.tools.register(
      TOOL_NAMES.replaceAllText,
      {
        displayName: "Replace Text In Google Doc",
        description: "Run a Google Docs replaceAllText request.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> =>
        await callGoogleTool(ctx, replaceAllText, params),
    );

    ctx.tools.register(
      TOOL_NAMES.batchUpdate,
      {
        displayName: "Google Docs Batch Update",
        description: "Run a bounded Google Docs batchUpdate request.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> =>
        await callGoogleTool(ctx, batchUpdate, params),
    );

    ctx.tools.register(
      TOOL_NAMES.exportDoc,
      {
        displayName: "Export Google Doc",
        description: "Export a Google Doc as html, txt, pdf, or docx.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => await callGoogleTool(ctx, exportDoc, params),
    );
  },

  async onHealth() {
    return { status: "ok", message: "Google Drive Docs tools are registered" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
