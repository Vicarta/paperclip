import {
  definePlugin,
  runWorker,
  type ToolResult,
} from "../../sdk/dist/index.js";
import {
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";
import {
  fetchCreatorList,
  fetchDictionary,
  type CollaboratorCreatorListParams,
  type CollaboratorDictionaryParams,
  type CollaboratorPluginConfig,
} from "./collaborator-client.js";

async function getConfig(
  ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0],
) {
  return (await ctx.config.get()) as CollaboratorPluginConfig;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.creatorList,
      {
        displayName: "Collaborator Creator List",
        description:
          "Query the Collaborator.pro creator catalog. Read-only evidence collection; no deals, outreach, purchases, or spend.",
        parametersSchema: {
          type: "object",
          properties: {
            keywords: { type: "array", items: { type: "string" } },
            countries: { type: "array", items: { type: "number" } },
            regions: { type: "array", items: { type: "number" } },
            cities: { type: "array", items: { type: "number" } },
            languages: { type: "array", items: { type: "number" } },
            url: { type: "string" },
            priceMin: { type: "number" },
            priceMax: { type: "number" },
            priceWithWriting: { type: "boolean" },
            spelling: { type: "number", enum: [1, 2] },
            withInsurance: { type: "boolean" },
            trafficMin: { type: "number" },
            isTrafficGrown: { type: "boolean" },
            formatId: { type: "number", enum: [1] },
            speedMaxDays: { type: "number" },
            uniqueSitesOnly: { type: "boolean" },
            cfMin: { type: "number" },
            tfMin: { type: "number" },
            trMin: { type: "number" },
            mozDaMin: { type: "number" },
            ahrefsDrMin: { type: "number" },
            ahrefsRefdomainsMin: { type: "number" },
            ahrefsTrafficMin: { type: "number" },
            serpSdrMin: { type: "number" },
            serpKeywordsMin: { type: "number" },
            indexGoogleMin: { type: "number" },
            googleNews: { type: "number", enum: [0, 1, 2] },
            domainAgeMin: { type: "number" },
            maxAnchors: { type: "array", items: { type: "number", enum: [1, 2, 3] } },
            nofollow: { type: "number", enum: [0, 1, 2] },
            advertisingMark: { type: "boolean" },
            siteTypes: { type: "array", items: { type: "number", enum: [1, 2, 3, 4, 5, 6, 7] } },
            sort: { type: "string" },
            limit: { type: "number" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await fetchCreatorList({
          params: params as CollaboratorCreatorListParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.dictionaryCountries,
      {
        displayName: "Collaborator Countries Dictionary",
        description: "Fetch Collaborator.pro country ids.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await fetchDictionary({
          type: "countries",
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.dictionaryRegions,
      {
        displayName: "Collaborator Regions Dictionary",
        description: "Fetch Collaborator.pro region ids for a country id.",
        parametersSchema: {
          type: "object",
          properties: { countryId: { type: "number" } },
          required: ["countryId"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await fetchDictionary({
          type: "regions",
          params: params as CollaboratorDictionaryParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.dictionaryCities,
      {
        displayName: "Collaborator Cities Dictionary",
        description: "Fetch Collaborator.pro city ids for a region id.",
        parametersSchema: {
          type: "object",
          properties: { regionId: { type: "number" } },
          required: ["regionId"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await fetchDictionary({
          type: "cities",
          params: params as CollaboratorDictionaryParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.dictionaryLanguages,
      {
        displayName: "Collaborator Languages Dictionary",
        description: "Fetch Collaborator.pro language ids.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return await fetchDictionary({
          type: "languages",
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.testConnection,
      {
        displayName: "Collaborator Test Connection",
        description: "Verify the configured Collaborator.pro API key with a read-only dictionary request.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await fetchDictionary({
          type: "languages",
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
        return {
          content: "Collaborator API connection verified with languages dictionary.",
          data: result.data,
        };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
