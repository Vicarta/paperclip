import type { AdapterModel } from "@paperclipai/adapter-utils";
import {
  listOpenCodeModels,
  ensureOpenCodeModelConfiguredAndAvailable,
} from "@paperclipai/adapter-opencode-local/server";

function isOpenRouterModelId(value: string): boolean {
  return value.startsWith("openrouter/");
}

function filterOpenRouterModels(models: AdapterModel[]): AdapterModel[] {
  return models.filter((entry) => isOpenRouterModelId(entry.id));
}

function readConfiguredModel(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function listOpenRouterModels(): Promise<AdapterModel[]> {
  const models = await listOpenCodeModels();
  return filterOpenRouterModels(models);
}

export async function ensureOpenRouterModelConfiguredAndAvailable(input: {
  model?: unknown;
  command?: unknown;
  cwd?: unknown;
  env?: unknown;
}): Promise<AdapterModel[]> {
  const model = readConfiguredModel(input.model);
  if (!model) {
    throw new Error("OpenRouter requires `adapterConfig.model` in openrouter/provider/model format.");
  }
  if (!isOpenRouterModelId(model)) {
    throw new Error(`Configured model must start with openrouter/: ${model}`);
  }

  const discovered = filterOpenRouterModels(
    await ensureOpenCodeModelConfiguredAndAvailable(input),
  );

  if (discovered.length === 0) {
    throw new Error("OpenRouter returned no models. Verify OPENROUTER_API_KEY and provider access.");
  }

  if (!discovered.some((entry) => entry.id === model)) {
    const sample = discovered.slice(0, 12).map((entry) => entry.id).join(", ");
    throw new Error(
      `Configured OpenRouter model is unavailable: ${model}. Available models: ${sample}${discovered.length > 12 ? ", ..." : ""}`,
    );
  }

  return discovered;
}
