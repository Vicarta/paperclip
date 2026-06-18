export const PLUGIN_ID = "paperclip.openrouter-image-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const TOOL_NAMES = {
  generateImage: "generate-image",
} as const;

export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_IMAGE_MODEL = "google/gemini-3.1-flash-image";

export const OPENROUTER_COST_PROVIDER = "openrouter";
export const OPENROUTER_COST_BILLING_TYPE = "metered_api";
