import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildOpenRouterConfig(values: CreateConfigValues): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (values.instructionsFilePath) config.instructionsFilePath = values.instructionsFilePath;
  if (values.promptTemplate) config.promptTemplate = values.promptTemplate;
  if (values.bootstrapPrompt) config.bootstrapPromptTemplate = values.bootstrapPrompt;
  if (values.model) config.model = values.model;
  return config;
}
