import type { AdapterConfigFieldsProps } from "../types";
import {
  AutoExpandTextarea,
  DraftInput,
  Field,
  ToggleField,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (for example AGENTS.md) that Paperclip reads and injects into the system prompt before calling OpenRouter.";
const modelHint =
  "Direct OpenRouter model identifier in provider/model format, for example openai/gpt-5.2 or anthropic/claude-sonnet-4.5.";
const providerOnlyHint =
  "Optional comma-separated OpenRouter provider slugs. Example: cloudflare. Use the exact provider slug from the OpenRouter model provider list.";
const providerFallbackHint =
  "When disabled, OpenRouter must not fall back to another provider if the selected provider cannot serve the request.";

function buildModelOptions(models: Array<{ id: string; label: string }>) {
  return [...models].sort((a, b) => a.id.localeCompare(b.id));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function providerListToText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((part): part is string => typeof part === "string").join(", ");
  }
  return typeof value === "string" ? value : "";
}

function splitProviderList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanProvider(provider: Record<string, unknown>): Record<string, unknown> {
  const only = splitProviderList(providerListToText(provider.only));
  const next: Record<string, unknown> = {};
  if (only.length > 0) next.only = only;
  if (provider.allow_fallbacks === false) next.allow_fallbacks = false;
  return next;
}

export function OpenRouterConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
  hideInstructionsFile,
}: AdapterConfigFieldsProps) {
  const currentModel = isCreate
    ? values!.model
    : eff("adapterConfig", "model", String(config.model ?? ""));
  const currentInstructions = isCreate
    ? values!.instructionsFilePath ?? ""
    : eff("adapterConfig", "instructionsFilePath", String(config.instructionsFilePath ?? ""));
  const currentPromptTemplate = isCreate
    ? values!.promptTemplate
    : eff("adapterConfig", "promptTemplate", String(config.promptTemplate ?? ""));
  const currentBootstrapPrompt = isCreate
    ? values!.bootstrapPrompt
    : eff(
        "adapterConfig",
        "bootstrapPromptTemplate",
        String(config.bootstrapPromptTemplate ?? ""),
      );
  const currentProvider = isCreate
    ? {}
    : asRecord(eff("adapterConfig", "provider", config.provider ?? {}));
  const currentProviderOnly = isCreate
    ? values!.openRouterProviderOnly ?? ""
    : providerListToText(currentProvider.only);
  const currentAllowFallbacks = isCreate
    ? values!.openRouterAllowFallbacks !== false
    : currentProvider.allow_fallbacks !== false;
  const modelOptions = buildModelOptions(models);

  const markProvider = (patch: Record<string, unknown>) => {
    const next = cleanProvider({ ...currentProvider, ...patch });
    mark("adapterConfig", "provider", Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
        Direct external OpenRouter adapter. No local CLI is required on the Paperclip host. Set
        <span className="font-mono"> OPENROUTER_API_KEY</span> in Environment variables using a company secret reference when possible.
      </div>

      {!hideInstructionsFile && (
        <Field label="Agent instructions file" hint={instructionsFileHint}>
          <div className="flex items-center gap-2">
            <DraftInput
              value={currentInstructions}
              onCommit={(v) =>
                isCreate
                  ? set!({ instructionsFilePath: v })
                  : mark("adapterConfig", "instructionsFilePath", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}

      <Field label="Model" hint={modelHint}>
        {modelOptions.length > 0 ? (
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            value={currentModel}
            onChange={(e) =>
              isCreate
                ? set!({ model: e.target.value })
                : mark("adapterConfig", "model", e.target.value || undefined)
            }
          >
            <option value="">Select model…</option>
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
          </select>
        ) : (
          <DraftInput
            value={currentModel}
            onCommit={(v) =>
              isCreate
                ? set!({ model: v })
                : mark("adapterConfig", "model", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="openai/gpt-5.2"
          />
        )}
      </Field>

      <div className="grid gap-3 rounded-md border border-border/60 p-3">
        <Field label="Provider only" hint={providerOnlyHint}>
          <DraftInput
            value={currentProviderOnly}
            onCommit={(v) =>
              isCreate
                ? set!({ openRouterProviderOnly: v })
                : markProvider({ only: splitProviderList(v) })
            }
            immediate
            className={inputClass}
            placeholder="cloudflare"
          />
        </Field>
        <ToggleField
          label="Allow provider fallback"
          hint={providerFallbackHint}
          checked={currentAllowFallbacks}
          onChange={(v) =>
            isCreate
              ? set!({ openRouterAllowFallbacks: v })
              : markProvider({ allow_fallbacks: v ? undefined : false })
          }
        />
      </div>

      <Field label="Prompt Template">
        <AutoExpandTextarea
          value={currentPromptTemplate}
          onChange={(v) =>
            isCreate
              ? set!({ promptTemplate: v })
              : mark("adapterConfig", "promptTemplate", v || undefined)
          }
          placeholder="You are agent {{ agent.name }}. Continue your assigned Paperclip work."
          minRows={4}
        />
      </Field>
      <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        Prompt template is replayed on every heartbeat. Keep it compact and role-based; do not hardcode numeric stage IDs here.
      </div>

      <Field label="Bootstrap prompt (first run)">
        <AutoExpandTextarea
          value={currentBootstrapPrompt}
          onChange={(v) =>
            isCreate
              ? set!({ bootstrapPrompt: v })
              : mark("adapterConfig", "bootstrapPromptTemplate", v || undefined)
          }
          placeholder="Optional stable setup guidance for fresh OpenRouter runs"
          minRows={3}
        />
      </Field>
    </div>
  );
}
