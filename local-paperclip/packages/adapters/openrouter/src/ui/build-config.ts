import type { CreateConfigValues } from "@paperclipai/adapter-utils";

function splitProviderList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildOpenRouterConfig(values: CreateConfigValues): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (values.instructionsFilePath) config.instructionsFilePath = values.instructionsFilePath;
  if (values.promptTemplate) config.promptTemplate = values.promptTemplate;
  if (values.bootstrapPrompt) config.bootstrapPromptTemplate = values.bootstrapPrompt;
  if (values.model) config.model = values.model;
  const providerOnly = splitProviderList(values.openRouterProviderOnly);
  const fallbackExplicitlyDisabled = values.openRouterAllowFallbacks === false;
  if (providerOnly.length > 0 || fallbackExplicitlyDisabled) {
    config.provider = {
      ...(providerOnly.length > 0 ? { only: providerOnly } : {}),
      ...(fallbackExplicitlyDisabled ? { allow_fallbacks: false } : {}),
    };
  }
  return config;
}
