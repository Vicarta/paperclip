import type { UIAdapterModule } from "../types";
import { parseHttpStdoutLine } from "../http/parse-stdout";
import { buildOpenRouterConfig } from "@paperclipai/adapter-openrouter/ui";
import { OpenRouterConfigFields } from "./config-fields";

export const openRouterUIAdapter: UIAdapterModule = {
  type: "openrouter",
  label: "OpenRouter",
  parseStdoutLine: parseHttpStdoutLine,
  ConfigFields: OpenRouterConfigFields,
  buildAdapterConfig: buildOpenRouterConfig,
};
