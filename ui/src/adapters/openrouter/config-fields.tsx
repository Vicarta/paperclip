import type { AdapterConfigFieldsProps } from "../types";
import {
  AutoExpandTextarea,
  DraftInput,
  Field,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (for example AGENTS.md) that Paperclip reads and injects into the system prompt before calling OpenRouter.";
const modelHint =
  "Direct OpenRouter model identifier in provider/model format, for example openai/gpt-5.2 or anthropic/claude-sonnet-4.5.";

function buildModelOptions(models: Array<{ id: string; label: string }>) {
  return [...models].sort((a, b) => a.id.localeCompare(b.id));
}

export function OpenRouterConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
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
  const modelOptions = buildModelOptions(models);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
        Direct external OpenRouter adapter. No local CLI is required on the Paperclip host. Configure
        <span className="font-mono"> OPENROUTER_API_KEY</span> in company adapter settings.
      </div>

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
