import type { UIAdapterModule } from "../types";
import { parseOpenCodeStdoutLine, buildOpenRouterLocalConfig } from "@paperclipai/adapter-openrouter-local/ui";
import { OpenRouterLocalConfigFields } from "./config-fields";

export const openRouterLocalUIAdapter: UIAdapterModule = {
  type: "openrouter_local",
  label: "OpenRouter via OpenCode (local)",
  parseStdoutLine: parseOpenCodeStdoutLine,
  ConfigFields: OpenRouterLocalConfigFields,
  buildAdapterConfig: buildOpenRouterLocalConfig,
};
