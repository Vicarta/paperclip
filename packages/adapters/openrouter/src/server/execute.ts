import { promises as fs } from "node:fs";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asNumber,
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
import {
  buildOpenRouterIssueProtocolInstruction,
  parseOpenRouterIssueProtocolIntent,
} from "./paperclip-protocol.js";
import { upsertIssueDocumentViaApi } from "./paperclip-issue-client.js";

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
  const systemPrompt = joinPromptSections([instructionsPrefix, renderedBootstrapPrompt]);
  const protocolInstruction =
    currentIssueId && authToken
      ? buildOpenRouterIssueProtocolInstruction({
          issueIdentifier: currentIssueIdentifier,
          issueId: currentIssueId,
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
      if (!intent) {
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

      const apiUrl = buildPaperclipEnv({
        id: agent.id,
        companyId: agent.companyId,
      }).PAPERCLIP_API_URL.trim();
      if (!apiUrl) {
        throw new Error("OpenRouter issue protocol requires an internal Paperclip API URL.");
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "X-Paperclip-Run-Id": runId,
      };

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
        const artifactResponse = await fetch(
          `${apiUrl.replace(/\/+$/, "")}/api/issues/${encodeURIComponent(currentIssueId)}/artifacts/file`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              relativePath: intent.artifact.relativePath,
              body: intent.artifact.body,
            }),
          },
        );
        const artifactText = await artifactResponse.text();
        const artifactPayload = artifactText ? parseJson(artifactText) : null;
        if (!artifactResponse.ok) {
          throw new Error(
            `Paperclip issue artifact write failed (${artifactResponse.status}): ${summarizeErrorPayload(artifactPayload) || artifactText || "unknown error"}`,
          );
        }
      }

      if (intent.status || intent.comment) {
        const patchResponse = await fetch(
          `${apiUrl.replace(/\/+$/, "")}/api/issues/${encodeURIComponent(currentIssueId)}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              ...(intent.status ? { status: intent.status } : {}),
              ...(intent.comment ? { comment: intent.comment } : {}),
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
