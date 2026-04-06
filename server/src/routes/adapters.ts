import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import type { AdapterCatalogDetail, AdapterCatalogEntry, AdapterRuntimeKind } from "@paperclipai/shared";
import {
  AGENT_ADAPTER_CREATION_UI_TYPES,
  AGENT_ADAPTER_ISSUE_OVERRIDE_TYPES,
  AGENT_ADAPTER_LABELS,
} from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { listServerAdapters } from "../adapters/index.js";
import { agentService } from "../services/agents.js";

const ADAPTER_DESCRIPTIONS: Record<string, string> = {
  claude_local: "Run agents locally with Claude Code.",
  codex_local: "Run agents locally with Codex.",
  gemini_local: "Run agents locally with Gemini CLI.",
  opencode_local: "Run agents locally through OpenCode with multi-provider routing.",
  openrouter_local: "Run agents locally through OpenCode, pinned to OpenRouter-backed models.",
  pi_local: "Run agents locally with Pi.",
  cursor: "Run agents locally with Cursor.",
  openclaw_gateway: "Invoke agents through the OpenClaw gateway protocol.",
  hermes_local: "Run agents locally with Hermes.",
  process: "Run one-shot local processes without a structured agent runtime.",
  http: "Invoke a remote HTTP endpoint as the agent runtime.",
};

function runtimeKindForAdapter(type: string): AdapterRuntimeKind {
  if (type === "openclaw_gateway" || type === "http") return "gateway";
  if (type === "process") return "builtin";
  return "local_cli";
}

function hasCreatePermission(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

function toCatalogEntry(detail: AdapterCatalogDetail): AdapterCatalogEntry {
  const { configurationDoc: _configurationDoc, ...entry } = detail;
  return entry;
}

export function adapterRoutes(db: Db) {
  const router = Router();
  const agentsSvc = agentService(db);

  async function assertCanRead(req: Request) {
    if (req.actor.type === "board") return;
    if (req.actor.type !== "agent" || !req.actor.agentId) {
      throw forbidden("Board or permitted agent authentication required");
    }
    const actorAgent = await agentsSvc.getById(req.actor.agentId);
    if (!actorAgent || !hasCreatePermission(actorAgent)) {
      throw forbidden("Missing permission to read adapter configuration reflection");
    }
  }

  function buildDetail(adapterType: string): AdapterCatalogDetail | null {
    const adapter = listServerAdapters().find((entry) => entry.type === adapterType);
    if (!adapter) return null;
    return {
      type: adapter.type,
      label: AGENT_ADAPTER_LABELS[adapter.type as keyof typeof AGENT_ADAPTER_LABELS] ?? adapter.type,
      runtimeKind: runtimeKindForAdapter(adapter.type),
      description: ADAPTER_DESCRIPTIONS[adapter.type] ?? "Agent runtime adapter.",
      supportsLocalAgentJwt: adapter.supportsLocalAgentJwt === true,
      supportsModelDiscovery: Boolean(adapter.listModels || (adapter.models?.length ?? 0) > 0),
      supportsEnvironmentTest: typeof adapter.testEnvironment === "function",
      supportsIssueOverrides: AGENT_ADAPTER_ISSUE_OVERRIDE_TYPES.includes(
        adapter.type as (typeof AGENT_ADAPTER_ISSUE_OVERRIDE_TYPES)[number],
      ),
      availableInAgentCreationUi: AGENT_ADAPTER_CREATION_UI_TYPES.includes(
        adapter.type as (typeof AGENT_ADAPTER_CREATION_UI_TYPES)[number],
      ),
      configurationDoc:
        adapter.agentConfigurationDoc ??
        `# ${adapter.type} adapter\n\nNo adapter-specific documentation registered.`,
    };
  }

  router.get("/adapters", async (req, res) => {
    await assertCanRead(req);
    const entries = listServerAdapters()
      .map((adapter) => buildDetail(adapter.type))
      .filter((entry): entry is AdapterCatalogDetail => Boolean(entry))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((detail) => toCatalogEntry(detail));
    res.json(entries);
  });

  router.get("/adapters/:type", async (req, res) => {
    await assertCanRead(req);
    const detail = buildDetail(req.params.type as string);
    if (!detail) {
      res.status(404).json({ error: `Unknown adapter type: ${req.params.type}` });
      return;
    }
    res.json(detail);
  });

  return router;
}
