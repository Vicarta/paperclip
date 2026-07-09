import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID, TOOL_NAMES } from "./constants.js";
import {
  buildSessionPath,
  callCrawlObserverApi,
  prepareLinksQuery,
  prepareMutatingSessionRequest,
  preparePageDetailQuery,
  preparePageIssuesQuery,
  preparePagesQuery,
  prepareReadEndpointRequest,
  prepareResourceChecksQuery,
  prepareSessionsQuery,
  prepareStartCrawlBody,
  type CrawlObserverPluginConfig,
  type CrawlObserverRequest,
} from "./crawlobserver-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as CrawlObserverPluginConfig;
}

async function callApi(input: {
  ctx: PluginSetupContext;
  request: CrawlObserverRequest;
}): Promise<ToolResult> {
  const config = await getConfig(input.ctx);
  const result = await callCrawlObserverApi({
    config,
    request: input.request,
    resolveSecret: (secretRef) => input.ctx.secrets.resolve(secretRef),
    fetchFn: input.ctx.http.fetch,
  });
  return {
    content: result.content,
    data: result.data,
  };
}

function sessionGetRequest(params: unknown, suffix: string): CrawlObserverRequest {
  return {
    method: "GET",
    path: buildSessionPath({ params, suffix }),
  };
}

function sessionPagedGetRequest(
  params: unknown,
  suffix: string,
  query: Record<string, string | number | boolean | null | undefined>,
): CrawlObserverRequest {
  return {
    method: "GET",
    path: buildSessionPath({ params, suffix }),
    query,
  };
}

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.healthCheck,
      {
        displayName: "CrawlObserver Health Check",
        description: "Call `GET /api/health`.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> =>
        await callApi({ ctx, request: { method: "GET", path: "/api/health" } }),
    );

    for (const tool of [
      [TOOL_NAMES.serverInfo, "CrawlObserver Server Info", "/api/server-info"],
      [TOOL_NAMES.systemStats, "CrawlObserver System Stats", "/api/system-stats"],
      [TOOL_NAMES.storageStats, "CrawlObserver Storage Stats", "/api/storage-stats"],
      [TOOL_NAMES.globalStats, "CrawlObserver Global Stats", "/api/global-stats"],
      [TOOL_NAMES.listProjects, "CrawlObserver List Projects", "/api/projects"],
    ] as const) {
      ctx.tools.register(
        tool[0],
        {
          displayName: tool[1],
          description: `Call \`GET ${tool[2]}\`.`,
          parametersSchema: looseObjectSchema,
        },
        async (): Promise<ToolResult> =>
          await callApi({ ctx, request: { method: "GET", path: tool[2] } }),
      );
    }

    ctx.tools.register(
      TOOL_NAMES.listSessions,
      {
        displayName: "CrawlObserver List Sessions",
        description: "Call `GET /api/sessions`.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await callApi({
          ctx,
          request: {
            method: "GET",
            path: "/api/sessions",
            query: prepareSessionsQuery({ params, config }),
          },
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.startCrawl,
      {
        displayName: "CrawlObserver Start Crawl",
        description:
          "Start a crawl session. Requires plugin config `allowMutatingTools=true`.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await callApi({
          ctx,
          request: {
            method: "POST",
            path: "/api/crawl",
            body: prepareStartCrawlBody({ params, config }),
          },
        });
      },
    );

    for (const tool of [
      [TOOL_NAMES.stopSession, "CrawlObserver Stop Session", "/stop"],
      [TOOL_NAMES.resumeSession, "CrawlObserver Resume Session", "/resume"],
      [TOOL_NAMES.retryFailed, "CrawlObserver Retry Failed", "/retry-failed"],
    ] as const) {
      ctx.tools.register(
        tool[0],
        {
          displayName: tool[1],
          description: `${tool[1]}. Requires plugin config \`allowMutatingTools=true\`.`,
          parametersSchema: looseObjectSchema,
        },
        async (params): Promise<ToolResult> => {
          const config = await getConfig(ctx);
          return await callApi({
            ctx,
            request: prepareMutatingSessionRequest({
              params,
              config,
              suffix: tool[2],
            }),
          });
        },
      );
    }

    for (const tool of [
      [TOOL_NAMES.getSessionProgress, "CrawlObserver Session Progress", "/progress"],
      [TOOL_NAMES.getSessionStats, "CrawlObserver Session Stats", "/stats"],
      [TOOL_NAMES.getSessionAudit, "CrawlObserver Session Audit", "/audit"],
      [TOOL_NAMES.getSessionQuality, "CrawlObserver Session Quality", "/quality"],
      [TOOL_NAMES.getSitemaps, "CrawlObserver Sitemaps", "/sitemaps"],
      [TOOL_NAMES.getResourceSummary, "CrawlObserver Resource Summary", "/resource-checks/summary"],
    ] as const) {
      ctx.tools.register(
        tool[0],
        {
          displayName: tool[1],
          description: `${tool[1]}.`,
          parametersSchema: looseObjectSchema,
        },
        async (params): Promise<ToolResult> =>
          await callApi({ ctx, request: sessionGetRequest(params, tool[2]) }),
      );
    }

    ctx.tools.register(
      TOOL_NAMES.listPages,
      {
        displayName: "CrawlObserver List Pages",
        description: "Call `GET /api/sessions/{id}/pages`.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await callApi({
          ctx,
          request: sessionPagedGetRequest(
            params,
            "/pages",
            preparePagesQuery({ params, config }),
          ),
        });
      },
    );

    for (const tool of [
      [TOOL_NAMES.listLinks, "CrawlObserver List Links", "/links"],
      [TOOL_NAMES.listInternalLinks, "CrawlObserver List Internal Links", "/internal-links"],
    ] as const) {
      ctx.tools.register(
        tool[0],
        {
          displayName: tool[1],
          description: `${tool[1]}.`,
          parametersSchema: looseObjectSchema,
        },
        async (params): Promise<ToolResult> => {
          const config = await getConfig(ctx);
          return await callApi({
            ctx,
            request: sessionPagedGetRequest(
              params,
              tool[2],
              prepareLinksQuery({ params, config }),
            ),
          });
        },
      );
    }

    ctx.tools.register(
      TOOL_NAMES.getPageDetail,
      {
        displayName: "CrawlObserver Page Detail",
        description: "Call `GET /api/sessions/{id}/page-detail?url=<url>`.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> =>
        await callApi({
          ctx,
          request: {
            method: "GET",
            path: buildSessionPath({ params, suffix: "/page-detail" }),
            query: preparePageDetailQuery(params),
          },
        }),
    );

    ctx.tools.register(
      TOOL_NAMES.getResourceChecks,
      {
        displayName: "CrawlObserver Resource Checks",
        description:
          "Call `GET /api/sessions/{id}/resource-checks` with allowlisted pagination and resource filters. Use `resource_type=image` for page-image audits.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await callApi({
          ctx,
          request: sessionPagedGetRequest(
            params,
            "/resource-checks",
            prepareResourceChecksQuery({ params, config }),
          ),
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getPageIssues,
      {
        displayName: "CrawlObserver Page Issues",
        description:
          "Call `GET /api/sessions/{id}/page-issues` with filters such as severity, issue_type, and url.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await callApi({
          ctx,
          request: sessionPagedGetRequest(
            params,
            "/page-issues",
            preparePageIssuesQuery({ params, config }),
          ),
        });
      },
    );

    for (const tool of [
      [TOOL_NAMES.getSitemapUrls, "CrawlObserver Sitemap URLs", "/sitemap-urls", preparePagesQuery],
      [TOOL_NAMES.getRedirectPages, "CrawlObserver Redirect Pages", "/redirect-pages", preparePagesQuery],
      [TOOL_NAMES.getNearDuplicates, "CrawlObserver Near Duplicates", "/near-duplicates", preparePagesQuery],
      [TOOL_NAMES.getStructuredData, "CrawlObserver Structured Data", "/structured-data", preparePagesQuery],
    ] as const) {
      ctx.tools.register(
        tool[0],
        {
          displayName: tool[1],
          description: `${tool[1]}.`,
          parametersSchema: looseObjectSchema,
        },
        async (params): Promise<ToolResult> => {
          const config = await getConfig(ctx);
          return await callApi({
            ctx,
            request: sessionPagedGetRequest(
              params,
              tool[2],
              tool[3]({ params, config }),
            ),
          });
        },
      );
    }

    ctx.tools.register(
      TOOL_NAMES.callReadEndpoint,
      {
        displayName: "CrawlObserver Call Read Endpoint",
        description: "Call one backend-allowlisted read-only CrawlObserver endpoint.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await callApi({
          ctx,
          request: prepareReadEndpointRequest({ params, config }),
        });
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
