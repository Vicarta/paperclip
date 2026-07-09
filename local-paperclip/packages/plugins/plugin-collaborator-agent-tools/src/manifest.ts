import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_COLLABORATOR_API_BASE_URL,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
} from "./constants.js";

const creatorFilterProperties = {
  keywords: {
    type: "array",
    items: { type: "string" },
    description: "Keyword filters for the Collaborator catalog.",
  },
  countries: {
    type: "array",
    items: { type: "number" },
    description: "Collaborator country ids.",
  },
  regions: {
    type: "array",
    items: { type: "number" },
    description: "Collaborator region ids.",
  },
  cities: {
    type: "array",
    items: { type: "number" },
    description: "Collaborator city ids.",
  },
  languages: {
    type: "array",
    items: { type: "number" },
    description: "Collaborator language ids.",
  },
  url: {
    type: "string",
    description: "Filter by site domain/address.",
  },
  priceMin: { type: "number" },
  priceMax: { type: "number" },
  priceWithWriting: { type: "boolean" },
  spelling: {
    type: "number",
    enum: [1, 2],
    description: "1 - with writing, 2 - without writing.",
  },
  withInsurance: { type: "boolean" },
  trafficMin: {
    type: "number",
    description: "Monthly traffic floor in thousands.",
  },
  isTrafficGrown: { type: "boolean" },
  formatId: {
    type: "number",
    enum: [1],
    description: "1 - article placement.",
  },
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
  googleNews: {
    type: "number",
    enum: [0, 1, 2],
    description: "0 - all, 1 - yes, 2 - no.",
  },
  domainAgeMin: { type: "number" },
  maxAnchors: {
    type: "array",
    items: { type: "number", enum: [1, 2, 3] },
  },
  nofollow: {
    type: "number",
    enum: [0, 1, 2],
    description: "0 - dofollow, 1 - nofollow, 2 - sponsored.",
  },
  advertisingMark: { type: "boolean" },
  siteTypes: {
    type: "array",
    items: { type: "number", enum: [1, 2, 3, 4, 5, 6, 7] },
    description:
      "1 personal blog, 2 corporate blog, 3 mass media, 4 online store, 5 information site, 6 portal, 7 publisher.",
  },
  sort: { type: "string" },
  limit: {
    type: "number",
    description: "Local output limit for normalized rows.",
  },
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Collaborator Agent Tools",
  description:
    "Read-only Collaborator.pro connector for marketplace-backed link acquisition evidence.",
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
      collaboratorApiKeySecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Collaborator API Key Secret Ref",
        description:
          "Paperclip secret UUID that stores the Collaborator.pro API key. Managed by the custom settings page.",
        default: "",
      },
      collaboratorApiBaseUrl: {
        type: "string",
        title: "Collaborator API Base URL",
        description: "Base URL for Collaborator.pro public API requests.",
        default: DEFAULT_COLLABORATOR_API_BASE_URL,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Collaborator Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.creatorList,
      displayName: "Collaborator Creator List",
      description:
        "Query the Collaborator.pro creator catalog for evidence-backed publisher candidates. Read-only; does not create deals or purchases.",
      parametersSchema: {
        type: "object",
        properties: creatorFilterProperties,
      },
    },
    {
      name: TOOL_NAMES.dictionaryCountries,
      displayName: "Collaborator Countries Dictionary",
      description: "Fetch Collaborator.pro country ids.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: TOOL_NAMES.dictionaryRegions,
      displayName: "Collaborator Regions Dictionary",
      description: "Fetch Collaborator.pro region ids for a country id.",
      parametersSchema: {
        type: "object",
        properties: {
          countryId: { type: "number" },
        },
        required: ["countryId"],
      },
    },
    {
      name: TOOL_NAMES.dictionaryCities,
      displayName: "Collaborator Cities Dictionary",
      description: "Fetch Collaborator.pro city ids for a region id.",
      parametersSchema: {
        type: "object",
        properties: {
          regionId: { type: "number" },
        },
        required: ["regionId"],
      },
    },
    {
      name: TOOL_NAMES.dictionaryLanguages,
      displayName: "Collaborator Languages Dictionary",
      description: "Fetch Collaborator.pro language ids.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: TOOL_NAMES.testConnection,
      displayName: "Collaborator Test Connection",
      description:
        "Verify that the configured Collaborator.pro API key can access dictionaries.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

export default manifest;
