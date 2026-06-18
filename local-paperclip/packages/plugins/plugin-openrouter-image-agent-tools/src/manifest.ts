import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  OPENROUTER_COST_BILLING_TYPE,
  PLUGIN_ID,
  PLUGIN_VERSION,
  TOOL_NAMES,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "OpenRouter Image Agent Tools",
  description:
    "Server-side OpenRouter image generation tool with secret-backed credentials and Paperclip cost ledger accounting.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
    "plugin.state.read",
    "plugin.state.write",
    "costs.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      openrouterApiKeySecretRef: {
        type: "string",
        format: "secret-ref",
        title: "OpenRouter API Key Secret Ref",
        description:
          "Paperclip secret UUID that stores the OpenRouter API key. The secret value is never exposed to agents.",
        default: "",
      },
      openrouterBaseUrl: {
        type: "string",
        title: "OpenRouter Base URL",
        description: "Base URL for OpenRouter API requests.",
        default: DEFAULT_OPENROUTER_BASE_URL,
      },
      defaultModel: {
        type: "string",
        title: "Default Image Model",
        description: "Default OpenRouter image model used when a tool call omits model.",
        default: DEFAULT_OPENROUTER_IMAGE_MODEL,
      },
      costAccountingMode: {
        type: "string",
        title: "Cost Accounting Mode",
        description:
          "Use provider_reported when OpenRouter returns per-request cost. Use estimated_per_image when provider response has no cost field.",
        enum: ["provider_reported", "estimated_per_image", "disabled"],
        default: "provider_reported",
      },
      estimatedImageCostUsd: {
        type: "number",
        title: "Estimated Image Cost USD",
        description: `Fallback cost per successful image generation when OpenRouter does not report exact request cost. Written as ${OPENROUTER_COST_BILLING_TYPE}.`,
        default: 0,
      },
      appName: {
        type: "string",
        title: "OpenRouter App Name",
        description: "Sent as X-OpenRouter-Title for provider-side attribution.",
        default: "Paperclip",
      },
      siteUrl: {
        type: "string",
        title: "OpenRouter Site URL",
        description: "Optional HTTP-Referer value for OpenRouter attribution.",
        default: "",
      },
    },
  },
  tools: [
    {
      name: TOOL_NAMES.generateImage,
      displayName: "OpenRouter Generate Image",
      description:
        "Generate an image through OpenRouter using a governed prompt and write provider spend to Paperclip cost_events.",
      parametersSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          model: { type: "string" },
          aspectRatio: { type: "string" },
          imageSize: { type: "string" },
          outputFormat: { type: "string", enum: ["png", "jpg", "jpeg", "webp"] },
          temperature: { type: "number" },
          topP: { type: "number" },
          seed: { type: "number" },
          metadata: { type: "object" },
          returnImageData: { type: "boolean" },
        },
        required: ["prompt"],
      },
    },
  ],
};

export default manifest;
