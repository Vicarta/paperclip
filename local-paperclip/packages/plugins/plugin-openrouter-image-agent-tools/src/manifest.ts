import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  DEFAULT_TARGET_DIMENSION_TOLERANCE_PERCENT,
  OPENROUTER_COST_BILLING_TYPE,
  PLUGIN_ID,
  PLUGIN_VERSION,
  TOOL_NAMES,
} from "./constants.js";
import { HUMAN_ART_DIRECTION_SCHEMA } from "./art-direction.js";

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
      allowModelOverride: {
        type: "boolean",
        title: "Allow Model Override",
        description:
          "When false, tool-call model parameters are ignored and the configured default model is always used.",
        default: true,
      },
      maxImagesPerRequest: {
        type: "number",
        title: "Max Images Per Request",
        description:
          "Caps n/candidateCount so agents cannot accidentally create multiple paid image generations.",
        default: 10,
      },
      defaultImageSize: {
        type: "string",
        title: "Default Image Size",
        description:
          "Default requested image size or CMS target dimensions when the tool call omits size/imageSize/resolution.",
        default: "",
      },
      defaultAspectRatio: {
        type: "string",
        title: "Default Aspect Ratio",
        description: "Default image aspect ratio when the tool call omits aspectRatio.",
        default: "",
      },
      targetDimensionTolerancePercent: {
        type: "number",
        title: "Target Dimension Tolerance Percent",
        description:
          "Maximum allowed absolute deviation on each image dimension from a requested pixel target.",
        minimum: 0,
        maximum: 100,
        default: DEFAULT_TARGET_DIMENSION_TOLERANCE_PERCENT,
      },
      requireSubjectMode: {
        type: "boolean",
        title: "Require Subject Mode",
        description: "Require every generation to declare human_scene or abstract_graphic.",
        default: false,
      },
      structuredArtDirectionMode: {
        type: "string",
        title: "Structured Art Direction Mode",
        enum: ["optional", "required_for_human_scene"],
        default: "optional",
      },
      visualHistoryLimit: {
        type: "number",
        title: "Visual History Limit",
        description: "Number of recent company-scoped human-scene fingerprints retained for diversity checks.",
        minimum: 1,
        maximum: 20,
        default: 8,
      },
      minimumDistinctVisualAxes: {
        type: "number",
        title: "Minimum Distinct Visual Axes",
        description: "Minimum differences required against each recent human-scene fingerprint before a paid call.",
        minimum: 1,
        maximum: 9,
        default: 4,
      },
      legacyAvoidVisualPatterns: {
        type: "array",
        title: "Legacy Visual Patterns To Avoid",
        description: "Known overused compositions appended to governed human-scene prompts.",
        items: { type: "string" },
        default: [],
      },
      defaultOutputDir: {
        type: "string",
        title: "Default Output Directory",
        description:
          "Absolute directory where generated image files are written when the tool call has no execution workspace or outputDir.",
        default: "",
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
      name: TOOL_NAMES.getVisualHistory,
      displayName: "Get Recent Image Visual History",
      description:
        "Read recent company-scoped human-scene visual fingerprints before planning a new paid image generation.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 20 },
        },
      },
    },
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
          size: { type: "string" },
          resolution: { type: "string" },
          candidateCount: { type: "number" },
          n: { type: "number" },
          outputDir: { type: "string" },
          outputFormat: { type: "string", enum: ["png", "jpg", "jpeg", "webp"] },
          temperature: { type: "number" },
          topP: { type: "number" },
          seed: { type: "number" },
          metadata: { type: "object" },
          returnImageData: { type: "boolean" },
          subjectMode: { type: "string", enum: ["human_scene", "abstract_graphic"] },
          artDirection: HUMAN_ART_DIRECTION_SCHEMA,
        },
        required: ["prompt"],
      },
    },
  ],
};

export default manifest;
