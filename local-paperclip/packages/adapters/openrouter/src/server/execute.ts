import { promises as fs } from "node:fs";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asNumber,
  asBoolean,
  asString,
  buildPaperclipEnv,
  joinPromptSections,
  parseJson,
  parseObject,
  redactEnvForLogs,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";
import {
  buildOpenRouterHeaders,
  extractAssistantText,
  extractCostUsd,
  normalizeOpenRouterModelId,
  resolveOpenRouterSettings,
  summarizeErrorPayload,
} from "./shared.js";
import { loadOpenRouterPromptSkills } from "./skills.js";
import {
  buildOpenRouterIssueProtocolInstruction,
  parseOpenRouterIssueProtocolIntent,
} from "./paperclip-protocol.js";
import { uploadIssueArtifactViaApi, upsertIssueDocumentViaApi } from "./paperclip-issue-client.js";
import { persistIssueArtifactToWorkspace } from "./paperclip-workspace-artifact.js";

type OpenRouterResponse = {
  model?: unknown;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  } | null;
} & Record<string, unknown>;

function renderTextSection(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadInstructions(
  instructionsFilePath: string,
  onLog: AdapterExecutionContext["onLog"],
): Promise<string> {
  if (!instructionsFilePath) return "";
  try {
    const instructionsContents = await fs.readFile(instructionsFilePath, "utf8");
    const instructionsDir = path.dirname(instructionsFilePath);
    await onLog(
      "stdout",
      `[paperclip] Loaded agent instructions file: ${instructionsFilePath}\n`,
    );
    return (
      `${instructionsContents}\n\n` +
      `The above agent instructions were loaded from ${instructionsFilePath}. ` +
      `Resolve any relative file references from ${instructionsDir}.\n\n`
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await onLog(
      "stderr",
      `[paperclip] Warning: could not read agent instructions file "${instructionsFilePath}": ${reason}\n`,
    );
    return "";
  }
}

function resolveWorkspaceRoot(context: Record<string, unknown>) {
  return (
    asString(parseObject(context.paperclipWorkspace).cwd, "").trim() ||
    asString(parseObject(Array.isArray(context.paperclipWorkspaces) ? context.paperclipWorkspaces[0] : null).cwd, "").trim()
  );
}

function buildProtocolBlockedComment(input: {
  reason: string;
  rawPreview?: string | null;
  requireArtifactOnDone?: boolean;
}) {
  const lines = [
    "## OpenRouter adapter blocked",
    "",
    input.reason,
    "",
    "This is an internal adapter/protocol blocker, not a human decision.",
  ];
  if (input.requireArtifactOnDone) {
    lines.push("", "This run requires a canonical workspace artifact before the issue can be marked done.");
  }
  if (input.rawPreview) {
    lines.push("", "Assistant output preview:", "", "```text", input.rawPreview.slice(0, 1200), "```");
  }
  return lines.join("\n");
}

async function patchIssueViaApi(input: {
  apiUrl: string;
  authToken: string;
  runId: string;
  issueId: string;
  status?: string;
  comment?: string;
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.authToken}`,
    "Content-Type": "application/json",
    "X-Paperclip-Run-Id": input.runId,
  };
  const patchResponse = await fetch(
    `${input.apiUrl.replace(/\/+$/, "")}/api/issues/${encodeURIComponent(input.issueId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        ...(input.status ? { status: input.status } : {}),
        ...(input.comment ? { comment: input.comment } : {}),
      }),
    },
  );
  const patchText = await patchResponse.text();
  const patchPayload = patchText ? parseJson(patchText) : null;
  if (!patchResponse.ok) {
    throw new Error(
      `Paperclip issue patch failed (${patchResponse.status}): ${summarizeErrorPayload(patchPayload) || patchText || "unknown error"}`,
    );
  }
}

function readUsage(value: OpenRouterResponse["usage"]) {
  const promptTokens =
    typeof value?.prompt_tokens === "number" && Number.isFinite(value.prompt_tokens)
      ? value.prompt_tokens
      : 0;
  const completionTokens =
    typeof value?.completion_tokens === "number" && Number.isFinite(value.completion_tokens)
      ? value.completion_tokens
      : 0;
  return {
    inputTokens: promptTokens,
    outputTokens: completionTokens,
  };
}

function normalizeProviderList(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
}

function normalizeOpenRouterProviderRouting(value: unknown): Record<string, unknown> | null {
  const source = parseObject(value);
  const provider: Record<string, unknown> = {};

  for (const key of ["order", "only", "ignore"] as const) {
    const list = normalizeProviderList(source[key]);
    if (list.length > 0) provider[key] = list;
  }

  for (const key of ["allow_fallbacks", "require_parameters", "zdr"] as const) {
    if (typeof source[key] === "boolean") provider[key] = source[key];
  }

  const dataCollection = asString(source.data_collection, "").trim();
  if (dataCollection === "allow" || dataCollection === "deny") {
    provider.data_collection = dataCollection;
  }

  const sort = asString(source.sort, "").trim();
  if (sort === "price" || sort === "throughput" || sort === "latency") {
    provider.sort = sort;
  }

  return Object.keys(provider).length > 0 ? provider : null;
}

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta, authToken } = ctx;
  const configRecord = parseObject(config);
  const settings = resolveOpenRouterSettings(configRecord);
  if (!settings.apiKey) {
    throw new Error("OpenRouter adapter requires OPENROUTER_API_KEY.");
  }

  const model = normalizeOpenRouterModelId(configRecord.model);
  if (!model) {
    throw new Error("OpenRouter adapter requires adapterConfig.model.");
  }

  const promptTemplate = asString(
    configRecord.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const bootstrapPromptTemplate = asString(configRecord.bootstrapPromptTemplate, "");
  const instructionsFilePath = asString(configRecord.instructionsFilePath, "");
  const instructionsPrefix = await loadInstructions(instructionsFilePath, onLog);
  const skillContext = await loadOpenRouterPromptSkills(configRecord);
  if (skillContext.desiredSkills.length > 0) {
    await onLog(
      "stdout",
      `[paperclip] OpenRouter prompt skills configured: ${skillContext.desiredSkills.join(", ")}\n`,
    );
  }
  if (skillContext.missingSkills.length > 0) {
    await onLog(
      "stderr",
      `[paperclip] Warning: missing OpenRouter prompt skills: ${skillContext.missingSkills.join(", ")}\n`,
    );
  }
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData).trim();
  const renderedBootstrapPrompt =
    bootstrapPromptTemplate.trim().length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const currentIssueContext = renderTextSection(context.paperclipCurrentIssueMarkdown);
  const currentIssueId = asString(context.paperclipIssueId, "").trim() || null;
  const currentIssueIdentifier = asString(context.paperclipIssueIdentifier, "").trim() || null;
  const humanFacingLanguageInstruction = renderTextSection(
    context.paperclipHumanFacingLanguageInstruction,
  );
  const sessionHandoffNote = renderTextSection(context.paperclipSessionHandoffMarkdown);
  const requireArtifactOnDone = asBoolean(configRecord.requireArtifactOnDone, false);
  const systemPrompt = joinPromptSections([
    instructionsPrefix,
    skillContext.text,
    renderedBootstrapPrompt,
  ]);
  const protocolInstruction =
    currentIssueId && authToken
      ? buildOpenRouterIssueProtocolInstruction({
          issueIdentifier: currentIssueIdentifier,
          issueId: currentIssueId,
          requireArtifactOnDone,
        })
      : "";
  const userPrompt =
    joinPromptSections([
      currentIssueContext,
      humanFacingLanguageInstruction,
      sessionHandoffNote,
      renderedPrompt,
      protocolInstruction,
    ]) || "Continue your assigned Paperclip work.";

  const promptMetrics = {
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
    instructionsChars: instructionsPrefix.length,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    currentIssueContextChars: currentIssueContext.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length,
  };

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };
  const providerRouting = normalizeOpenRouterProviderRouting(configRecord.provider);
  if (providerRouting) {
    requestBody.provider = providerRouting;
  }
  const maxCompletionTokens = asNumber(configRecord.maxCompletionTokens, 0);
  if (maxCompletionTokens > 0) {
    requestBody.max_completion_tokens = maxCompletionTokens;
  }
  const temperature = Number(configRecord.temperature);
  if (Number.isFinite(temperature)) {
    requestBody.temperature = temperature;
  }
  const reasoningEffort = asString(
    configRecord.reasoningEffort ?? configRecord.effort,
    "",
  ).trim();
  if (reasoningEffort) {
    requestBody.reasoning = { effort: reasoningEffort };
  }

  if (onMeta) {
    await onMeta({
      adapterType: "openrouter",
      command: "POST",
      cwd: settings.baseUrl,
      commandArgs: ["/chat/completions"],
      commandNotes: [
        "Direct HTTPS execution through OpenRouter chat completions.",
        "This adapter is stateless and does not depend on local CLI runtimes.",
      ],
      env: redactEnvForLogs({
        OPENROUTER_API_KEY: settings.apiKey,
        ...(settings.siteUrl ? { OPENROUTER_SITE_URL: settings.siteUrl } : {}),
        ...(settings.appName ? { OPENROUTER_APP_NAME: settings.appName } : {}),
      }),
      prompt: joinPromptSections([systemPrompt, userPrompt]),
      promptMetrics,
      context,
    });
  }

  const controller = new AbortController();
  const timeoutSec = asNumber(configRecord.timeoutSec, 120);
  const timer = timeoutSec > 0 ? setTimeout(() => controller.abort(), timeoutSec * 1000) : null;

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: buildOpenRouterHeaders(settings),
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload: OpenRouterResponse = {};
    try {
      payload = responseText ? (JSON.parse(responseText) as OpenRouterResponse) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const message =
        summarizeErrorPayload(payload) || responseText || `HTTP ${response.status}`;
      throw new Error(`OpenRouter request failed (${response.status}): ${message}`);
    }

    const assistantText = extractAssistantText(payload);
    if (!assistantText) {
      await onLog("stdout", "[paperclip] OpenRouter returned empty content.\n");
    } else if (!currentIssueId || !authToken) {
      await onLog("stdout", `${assistantText}\n`);
    }

    let protocolResult: Record<string, unknown> | null = null;
    if (assistantText && currentIssueId && authToken) {
      const intent = parseOpenRouterIssueProtocolIntent(assistantText);
      const apiUrl = buildPaperclipEnv({
        id: agent.id,
        companyId: agent.companyId,
      }).PAPERCLIP_API_URL.trim();
      if (!apiUrl) {
        throw new Error("OpenRouter issue protocol requires an internal Paperclip API URL.");
      }

      if (!intent) {
        await patchIssueViaApi({
          apiUrl,
          authToken,
          runId,
          issueId: currentIssueId,
          status: "blocked",
          comment: buildProtocolBlockedComment({
            reason:
              "The model returned text that could not be parsed as the required Paperclip issue JSON object.",
            rawPreview: assistantText,
          }),
        });
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorCode: "protocol_parse_error",
          errorMessage:
            "OpenRouter agent must return a valid Paperclip issue JSON object for issue-bound runs.",
          usage: readUsage(payload.usage),
          provider: "openrouter",
          model: asString(payload.model, model),
          billingType: "api",
          costUsd: extractCostUsd(payload),
          resultJson: {
            provider: "openrouter",
            protocol: {
              applied: false,
              error: "protocol_parse_error",
              rawPreview: assistantText.slice(0, 400),
            },
          },
          summary: `OpenRouter ${model}`,
          clearSession: true,
        };
      }

      if (requireArtifactOnDone && intent.status === "done" && !intent.artifact) {
        await patchIssueViaApi({
          apiUrl,
          authToken,
          runId,
          issueId: currentIssueId,
          status: "blocked",
          comment: buildProtocolBlockedComment({
            reason:
              "The model tried to mark the issue done without returning the required canonical workspace artifact.",
            requireArtifactOnDone: true,
          }),
        });
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorCode: "artifact_required_on_done",
          errorMessage:
            "OpenRouter issue-bound run requires artifact when status is done.",
          usage: readUsage(payload.usage),
          provider: "openrouter",
          model: asString(payload.model, model),
          billingType: "api",
          costUsd: extractCostUsd(payload),
          resultJson: {
            provider: "openrouter",
            protocol: {
              applied: false,
              error: "artifact_required_on_done",
              status: intent.status,
              hasDocument: Boolean(intent.document),
            },
          },
          summary: `OpenRouter ${model}`,
          clearSession: true,
        };
      }

      if (intent.document) {
        await upsertIssueDocumentViaApi({
          apiUrl,
          authToken,
          runId,
          issueId: currentIssueId,
          key: intent.document.key,
          title: intent.document.title,
          body: intent.document.body,
          changeSummary: intent.document.changeSummary,
        });
      }

      if (intent.artifact) {
        const workspaceRoot = resolveWorkspaceRoot(context);
        await persistIssueArtifactToWorkspace({
          workspaceRoot,
          relativePath: intent.artifact.relativePath,
          body: intent.artifact.body,
        });
        await uploadIssueArtifactViaApi({
          apiUrl,
          authToken,
          runId,
          companyId: agent.companyId,
          issueId: currentIssueId,
          relativePath: intent.artifact.relativePath,
          body: intent.artifact.body,
        });
      }

      if (intent.status || intent.comment) {
        await patchIssueViaApi({
          apiUrl,
          authToken,
          runId,
          issueId: currentIssueId,
          status: intent.status ?? undefined,
          comment: intent.comment ?? undefined,
        });
      }

      await onLog(
        "stdout",
        `[paperclip] Applied issue protocol for ${currentIssueIdentifier ?? currentIssueId}:` +
          `${intent.artifact ? ` artifact=${intent.artifact.relativePath}` : ""}` +
          `${intent.document ? ` document=${intent.document.key}` : ""}` +
          `${intent.status ? ` status=${intent.status}` : ""}\n`,
      );

      protocolResult = {
        applied: true,
        issueId: currentIssueId,
        issueIdentifier: currentIssueIdentifier,
        status: intent.status,
        commentPreview: intent.comment ? intent.comment.slice(0, 240) : null,
        document: intent.document
          ? {
              key: intent.document.key,
              title: intent.document.title,
              bodyChars: intent.document.body.length,
            }
          : null,
        artifact: intent.artifact
          ? {
              relativePath: intent.artifact.relativePath,
              bodyChars: intent.artifact.body.length,
            }
          : null,
      };
    }

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      usage: readUsage(payload.usage),
      provider: "openrouter",
      model: asString(payload.model, model),
      billingType: "api",
      costUsd: extractCostUsd(payload),
      resultJson: protocolResult
        ? {
            provider: "openrouter",
            model: asString(payload.model, model),
            protocol: protocolResult,
          }
        : payload,
      summary:
        protocolResult && typeof protocolResult.commentPreview === "string"
          ? protocolResult.commentPreview
          : `OpenRouter ${model}`,
      clearSession: true,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: 1,
        signal: null,
        timedOut: true,
        errorCode: "timeout",
        errorMessage: `OpenRouter request timed out after ${timeoutSec} seconds.`,
        provider: "openrouter",
        model,
        billingType: "api",
        clearSession: true,
      };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
