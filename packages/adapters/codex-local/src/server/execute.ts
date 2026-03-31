import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePaperclipSkillSymlink,
  ensurePathInEnv,
  listPaperclipSkillEntries,
  removeMaintainerOnlySkillSymlinks,
  renderTemplate,
  joinPromptSections,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import { parseCodexJsonl, isCodexUnknownSessionError } from "./parse.js";
import {
  pathExists,
  prepareWorktreeCodexHome,
  resolveCodexHomeDir,
} from "./codex-home.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const CODEX_ROLLOUT_NOISE_RE =
  /^\d{4}-\d{2}-\d{2}T[^\s]+\s+ERROR\s+codex_core::rollout::list:\s+state db missing rollout path for thread\s+[a-z0-9-]+$/i;

function stripCodexRolloutNoise(text: string): string {
  const parts = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      kept.push(part);
      continue;
    }
    if (CODEX_ROLLOUT_NOISE_RE.test(trimmed)) continue;
    kept.push(part);
  }
  return kept.join("\n");
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function hasNonEmptyEnvValue(
  env: Record<string, string>,
  key: string
): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveCodexBillingType(
  env: Record<string, string>
): "api" | "subscription" {
  // Codex uses API-key auth when OPENAI_API_KEY is present; otherwise rely on local login/session auth.
  return hasNonEmptyEnvValue(env, "OPENAI_API_KEY") ? "api" : "subscription";
}

type AgentAttachmentContextEntry = {
  id: string;
  issueId: string;
  issueCommentId: string | null;
  originalFilename: string | null;
  contentType: string;
  byteSize: number;
  contentPath: string;
  source: "issue" | "comment";
};

type StagedAttachment = AgentAttachmentContextEntry & {
  stagedPath: string;
  kind: "image" | "pdf";
  extractedMarkdownPath?: string;
  extractedMarkdownContent?: string;
  extractedMarkdownCharCount?: number;
  ingestionMethod?: "markdown_new";
  ingestionFailureReason?: string | null;
};

const IMAGE_ATTACHMENT_PREFIX = "image/";
const PDF_ATTACHMENT_TYPE = "application/pdf";
const MAX_AGENT_ATTACHMENT_COUNT = 8;
const MAX_AGENT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_AGENT_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
const MARKDOWN_NEW_CONVERT_URL = "https://markdown.new/convert";
const MARKDOWN_NEW_TIMEOUT_MS = 30_000;
const MAX_PDF_MARKDOWN_PROMPT_CHARS_PER_FILE = 20_000;
const MAX_PDF_MARKDOWN_PROMPT_CHARS_TOTAL = 60_000;

function sanitizeAttachmentFilename(raw: string | null, fallback: string) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function normalizeAgentAttachmentEntry(
  value: unknown
): AgentAttachmentContextEntry | null {
  const obj = parseObject(value);
  const id = asString(obj.id, "").trim();
  const issueId = asString(obj.issueId, "").trim();
  const contentType = asString(obj.contentType, "").trim().toLowerCase();
  const contentPath = asString(obj.contentPath, "").trim();
  if (!id || !issueId || !contentType || !contentPath) return null;
  if (
    !(
      contentType.startsWith(IMAGE_ATTACHMENT_PREFIX) ||
      contentType === PDF_ATTACHMENT_TYPE
    )
  )
    return null;

  return {
    id,
    issueId,
    issueCommentId: asString(obj.issueCommentId, "").trim() || null,
    originalFilename: asString(obj.originalFilename, "").trim() || null,
    contentType,
    byteSize: Math.max(0, Math.floor(asNumber(obj.byteSize, 0))),
    contentPath,
    source: asString(obj.source, "issue") === "comment" ? "comment" : "issue",
  };
}

function summarizeAttachmentsForPrompt(staged: StagedAttachment[]): string {
  if (staged.length === 0) return "";

  const overviewLines = [
    "Paperclip attachment inputs for this run:",
    ...staged.map((attachment) => {
      const sourceLabel =
        attachment.source === "comment"
          ? "comment attachment"
          : "issue attachment";
      if (attachment.kind === "image") {
        return `- ${
          attachment.originalFilename ?? path.basename(attachment.stagedPath)
        } (${
          attachment.contentType
        }, ${sourceLabel}) is attached natively to Codex. Local copy: ${
          attachment.stagedPath
        }`;
      }
      if (attachment.extractedMarkdownContent) {
        return `- ${
          attachment.originalFilename ?? path.basename(attachment.stagedPath)
        } (${
          attachment.contentType
        }, ${sourceLabel}) was converted to Markdown via markdown.new. Local PDF copy: ${
          attachment.stagedPath
        }. Extracted Markdown file: ${
          attachment.extractedMarkdownPath ?? `${attachment.stagedPath}.md`
        }.`;
      }
      const reason = attachment.ingestionFailureReason?.trim();
      return `- ${
        attachment.originalFilename ?? path.basename(attachment.stagedPath)
      } (${attachment.contentType}, ${sourceLabel}) is available locally at ${
        attachment.stagedPath
      }. markdown.new ingestion was not available${
        reason ? `: ${reason}` : ""
      }. Current Codex CLI in Paperclip does not accept PDFs as native file input, so do not assume the PDF contents were read unless you extract them yourself.`;
    }),
  ];
  const extractedSections: string[] = [];
  let remainingChars = MAX_PDF_MARKDOWN_PROMPT_CHARS_TOTAL;
  for (const attachment of staged) {
    if (
      attachment.kind !== "pdf" ||
      !attachment.extractedMarkdownContent ||
      remainingChars <= 0
    )
      continue;
    const perFileBudget = Math.min(
      MAX_PDF_MARKDOWN_PROMPT_CHARS_PER_FILE,
      remainingChars
    );
    const truncated =
      attachment.extractedMarkdownContent.length > perFileBudget;
    const excerpt = truncated
      ? `${attachment.extractedMarkdownContent
          .slice(0, perFileBudget)
          .trimEnd()}\n\n[truncated after ${perFileBudget} characters]`
      : attachment.extractedMarkdownContent;
    extractedSections.push(
      `Extracted Markdown from ${
        attachment.originalFilename ?? path.basename(attachment.stagedPath)
      }:\n\n${excerpt}`
    );
    remainingChars -= excerpt.length;
  }

  return joinPromptSections([overviewLines.join("\n"), ...extractedSections]);
}

function resolveAttachmentApiUrl(baseUrl: string, contentPath: string): string {
  return new URL(
    contentPath,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  ).toString();
}

function normalizeMarkdownNewContent(value: unknown): string {
  const obj = parseObject(value);
  const data = parseObject(obj.data);
  const dataContent = asString(data.content, "");
  if (dataContent.trim().length > 0) return dataContent;
  const rootContent = asString(obj.content, "");
  if (rootContent.trim().length > 0) return rootContent;
  return "";
}

async function ingestPdfViaMarkdownNew(input: {
  pdfData: Buffer;
  originalFilename: string;
  convertUrl: string;
  onLog: AdapterExecutionContext["onLog"];
}): Promise<{ markdown: string; error: string | null }> {
  if (input.pdfData.byteLength > MAX_AGENT_ATTACHMENT_BYTES) {
    return {
      markdown: "",
      error: `file exceeds markdown.new upload limit of ${MAX_AGENT_ATTACHMENT_BYTES} bytes`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MARKDOWN_NEW_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.pdfData)], { type: PDF_ATTACHMENT_TYPE }),
      input.originalFilename
    );

    const response = await fetch(input.convertUrl, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        markdown: "",
        error: `${response.status} ${response.statusText}`.trim(),
      };
    }

    const payload = await response.json().catch(() => null);
    const markdown = normalizeMarkdownNewContent(payload);
    if (!markdown.trim()) {
      return {
        markdown: "",
        error: "response did not include extracted Markdown content",
      };
    }
    return { markdown, error: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await input.onLog(
      "stderr",
      `[paperclip] markdown.new ingestion failed for "${input.originalFilename}": ${reason}\n`
    );
    return { markdown: "", error: reason };
  } finally {
    clearTimeout(timeout);
  }
}

async function stageAgentAttachments(input: {
  attachments: AgentAttachmentContextEntry[];
  cwd: string;
  runId: string;
  apiUrl: string;
  apiKey: string | null;
  markdownNewConvertUrl: string;
  onLog: AdapterExecutionContext["onLog"];
}): Promise<{ staged: StagedAttachment[]; stageDir: string | null }> {
  if (input.attachments.length === 0) {
    return { staged: [], stageDir: null };
  }

  const stageDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `paperclip-codex-attachments-${input.runId}-`)
  );

  const staged: StagedAttachment[] = [];
  let totalBytes = 0;
  const limited = input.attachments.slice(0, MAX_AGENT_ATTACHMENT_COUNT);
  if (input.attachments.length > limited.length) {
    await input.onLog(
      "stderr",
      `[paperclip] Skipping ${
        input.attachments.length - limited.length
      } attachment(s): at most ${MAX_AGENT_ATTACHMENT_COUNT} media attachments are staged per run.\n`
    );
  }

  for (const attachment of limited) {
    const kind = attachment.contentType.startsWith(IMAGE_ATTACHMENT_PREFIX)
      ? "image"
      : attachment.contentType === PDF_ATTACHMENT_TYPE
      ? "pdf"
      : null;
    if (!kind) continue;

    if (attachment.byteSize > MAX_AGENT_ATTACHMENT_BYTES) {
      await input.onLog(
        "stderr",
        `[paperclip] Skipping attachment "${
          attachment.originalFilename ?? attachment.id
        }": ${
          attachment.byteSize
        } bytes exceeds per-file limit ${MAX_AGENT_ATTACHMENT_BYTES}.\n`
      );
      continue;
    }
    if (totalBytes + attachment.byteSize > MAX_AGENT_ATTACHMENT_TOTAL_BYTES) {
      await input.onLog(
        "stderr",
        `[paperclip] Skipping attachment "${
          attachment.originalFilename ?? attachment.id
        }": staged attachments would exceed total limit ${MAX_AGENT_ATTACHMENT_TOTAL_BYTES}.\n`
      );
      continue;
    }

    const response = await fetch(
      resolveAttachmentApiUrl(input.apiUrl, attachment.contentPath),
      {
        headers: input.apiKey
          ? { Authorization: `Bearer ${input.apiKey}` }
          : undefined,
      }
    );
    if (!response.ok) {
      await input.onLog(
        "stderr",
        `[paperclip] Failed to stage attachment "${
          attachment.originalFilename ?? attachment.id
        }": ${response.status} ${response.statusText}\n`
      );
      continue;
    }

    const data = Buffer.from(await response.arrayBuffer());
    const extension = path.extname(attachment.originalFilename ?? "");
    const targetName = `${staged.length + 1}-${sanitizeAttachmentFilename(
      attachment.originalFilename,
      `${attachment.id}${extension || (kind === "pdf" ? ".pdf" : "")}`
    )}`;
    const stagedPath = path.join(stageDir, targetName);
    await fs.writeFile(stagedPath, data);
    totalBytes += data.byteLength;
    const stagedAttachment: StagedAttachment = {
      ...attachment,
      kind,
      stagedPath,
    };
    if (kind === "pdf") {
      const { markdown, error } = await ingestPdfViaMarkdownNew({
        pdfData: data,
        originalFilename:
          attachment.originalFilename ?? path.basename(stagedPath),
        convertUrl: input.markdownNewConvertUrl,
        onLog: input.onLog,
      });
      if (markdown.trim()) {
        const markdownPath = `${stagedPath}.md`;
        await fs.writeFile(markdownPath, markdown, "utf8");
        stagedAttachment.extractedMarkdownPath = markdownPath;
        stagedAttachment.extractedMarkdownContent = markdown;
        stagedAttachment.extractedMarkdownCharCount = markdown.length;
        stagedAttachment.ingestionMethod = "markdown_new";
      } else if (error) {
        stagedAttachment.ingestionFailureReason = error;
      }
    }
    staged.push(stagedAttachment);
  }

  if (staged.length === 0) {
    await fs.rm(stageDir, { recursive: true, force: true });
    return { staged: [], stageDir: null };
  }

  return { staged, stageDir };
}

async function isLikelyPaperclipRepoRoot(candidate: string): Promise<boolean> {
  const [hasWorkspace, hasPackageJson, hasServerDir, hasAdapterUtilsDir] =
    await Promise.all([
      pathExists(path.join(candidate, "pnpm-workspace.yaml")),
      pathExists(path.join(candidate, "package.json")),
      pathExists(path.join(candidate, "server")),
      pathExists(path.join(candidate, "packages", "adapter-utils")),
    ]);

  return hasWorkspace && hasPackageJson && hasServerDir && hasAdapterUtilsDir;
}

async function isLikelyPaperclipRuntimeSkillSource(
  candidate: string,
  skillName: string
): Promise<boolean> {
  if (path.basename(candidate) !== skillName) return false;
  const skillsRoot = path.dirname(candidate);
  if (path.basename(skillsRoot) !== "skills") return false;
  if (!(await pathExists(path.join(candidate, "SKILL.md")))) return false;

  let cursor = path.dirname(skillsRoot);
  for (let depth = 0; depth < 6; depth += 1) {
    if (await isLikelyPaperclipRepoRoot(cursor)) return true;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return false;
}

type EnsureCodexSkillsInjectedOptions = {
  skillsHome?: string;
  skillsEntries?: Awaited<ReturnType<typeof listPaperclipSkillEntries>>;
  linkSkill?: (source: string, target: string) => Promise<void>;
};

export async function ensureCodexSkillsInjected(
  onLog: AdapterExecutionContext["onLog"],
  options: EnsureCodexSkillsInjectedOptions = {}
) {
  const skillsEntries =
    options.skillsEntries ?? (await listPaperclipSkillEntries(__moduleDir));
  if (skillsEntries.length === 0) return;

  const skillsHome =
    options.skillsHome ?? path.join(resolveCodexHomeDir(process.env), "skills");
  await fs.mkdir(skillsHome, { recursive: true });
  const removedSkills = await removeMaintainerOnlySkillSymlinks(
    skillsHome,
    skillsEntries.map((entry) => entry.name)
  );
  for (const skillName of removedSkills) {
    await onLog(
      "stderr",
      `[paperclip] Removed maintainer-only Codex skill "${skillName}" from ${skillsHome}\n`
    );
  }
  const linkSkill = options.linkSkill;
  for (const entry of skillsEntries) {
    const target = path.join(skillsHome, entry.name);

    try {
      const existing = await fs.lstat(target).catch(() => null);
      if (existing?.isSymbolicLink()) {
        const linkedPath = await fs.readlink(target).catch(() => null);
        const resolvedLinkedPath = linkedPath
          ? path.resolve(path.dirname(target), linkedPath)
          : null;
        if (
          resolvedLinkedPath &&
          resolvedLinkedPath !== entry.source &&
          (await isLikelyPaperclipRuntimeSkillSource(
            resolvedLinkedPath,
            entry.name
          ))
        ) {
          await fs.unlink(target);
          if (linkSkill) {
            await linkSkill(entry.source, target);
          } else {
            await fs.symlink(entry.source, target);
          }
          await onLog(
            "stderr",
            `[paperclip] Repaired Codex skill "${entry.name}" into ${skillsHome}\n`
          );
          continue;
        }
      }

      const result = await ensurePaperclipSkillSymlink(
        entry.source,
        target,
        linkSkill
      );
      if (result === "skipped") continue;

      await onLog(
        "stderr",
        `[paperclip] ${
          result === "repaired" ? "Repaired" : "Injected"
        } Codex skill "${entry.name}" into ${skillsHome}\n`
      );
    } catch (err) {
      await onLog(
        "stderr",
        `[paperclip] Failed to inject Codex skill "${
          entry.name
        }" into ${skillsHome}: ${
          err instanceof Error ? err.message : String(err)
        }\n`
      );
    }
  }
}

export async function execute(
  ctx: AdapterExecutionContext
): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, authToken } =
    ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work."
  );
  const command = asString(config.command, "codex");
  const model = asString(config.model, "");
  const modelReasoningEffort = asString(
    config.modelReasoningEffort,
    asString(config.reasoningEffort, "")
  );
  const search = asBoolean(config.search, false);
  const bypass = asBoolean(
    config.dangerouslyBypassApprovalsAndSandbox,
    asBoolean(config.dangerouslyBypassSandbox, false)
  );

  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceStrategy = asString(workspaceContext.strategy, "");
  const workspaceId = asString(workspaceContext.workspaceId, "");
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "");
  const workspaceRepoRef = asString(workspaceContext.repoRef, "");
  const workspaceBranch = asString(workspaceContext.branchName, "");
  const workspaceWorktreePath = asString(workspaceContext.worktreePath, "");
  const agentHome = asString(workspaceContext.agentHome, "");
  const workspaceHints = Array.isArray(context.paperclipWorkspaces)
    ? context.paperclipWorkspaces.filter(
        (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null
      )
    : [];
  const runtimeServiceIntents = Array.isArray(
    context.paperclipRuntimeServiceIntents
  )
    ? context.paperclipRuntimeServiceIntents.filter(
        (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null
      )
    : [];
  const runtimeServices = Array.isArray(context.paperclipRuntimeServices)
    ? context.paperclipRuntimeServices.filter(
        (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null
      )
    : [];
  const runtimePrimaryUrl = asString(context.paperclipRuntimePrimaryUrl, "");
  const attachmentContext = Array.isArray(context.paperclipAttachments)
    ? context.paperclipAttachments
        .map(normalizeAgentAttachmentEntry)
        .filter((value): value is AgentAttachmentContextEntry => value !== null)
    : [];
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome =
    workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome
    ? ""
    : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  const envConfig = parseObject(config.env);
  const configuredCodexHome =
    typeof envConfig.CODEX_HOME === "string" &&
    envConfig.CODEX_HOME.trim().length > 0
      ? path.resolve(envConfig.CODEX_HOME.trim())
      : null;
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  const preparedWorktreeCodexHome = configuredCodexHome
    ? null
    : await prepareWorktreeCodexHome(process.env, onLog);
  const effectiveCodexHome = configuredCodexHome ?? preparedWorktreeCodexHome;
  await ensureCodexSkillsInjected(
    onLog,
    effectiveCodexHome
      ? { skillsHome: path.join(effectiveCodexHome, "skills") }
      : {}
  );
  const hasExplicitApiKey =
    typeof envConfig.PAPERCLIP_API_KEY === "string" &&
    envConfig.PAPERCLIP_API_KEY.trim().length > 0;
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  if (effectiveCodexHome) {
    env.CODEX_HOME = effectiveCodexHome;
  }
  env.PAPERCLIP_RUN_ID = runId;
  const wakeTaskId =
    (typeof context.taskId === "string" &&
      context.taskId.trim().length > 0 &&
      context.taskId.trim()) ||
    (typeof context.issueId === "string" &&
      context.issueId.trim().length > 0 &&
      context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" &&
    context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" &&
      context.wakeCommentId.trim().length > 0 &&
      context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" &&
      context.commentId.trim().length > 0 &&
      context.commentId.trim()) ||
    null;
  const approvalId =
    typeof context.approvalId === "string" &&
    context.approvalId.trim().length > 0
      ? context.approvalId.trim()
      : null;
  const approvalStatus =
    typeof context.approvalStatus === "string" &&
    context.approvalStatus.trim().length > 0
      ? context.approvalStatus.trim()
      : null;
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    : [];
  if (wakeTaskId) {
    env.PAPERCLIP_TASK_ID = wakeTaskId;
  }
  if (wakeReason) {
    env.PAPERCLIP_WAKE_REASON = wakeReason;
  }
  if (wakeCommentId) {
    env.PAPERCLIP_WAKE_COMMENT_ID = wakeCommentId;
  }
  if (approvalId) {
    env.PAPERCLIP_APPROVAL_ID = approvalId;
  }
  if (approvalStatus) {
    env.PAPERCLIP_APPROVAL_STATUS = approvalStatus;
  }
  if (linkedIssueIds.length > 0) {
    env.PAPERCLIP_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  }
  if (effectiveWorkspaceCwd) {
    env.PAPERCLIP_WORKSPACE_CWD = effectiveWorkspaceCwd;
  }
  if (workspaceSource) {
    env.PAPERCLIP_WORKSPACE_SOURCE = workspaceSource;
  }
  if (workspaceStrategy) {
    env.PAPERCLIP_WORKSPACE_STRATEGY = workspaceStrategy;
  }
  if (workspaceId) {
    env.PAPERCLIP_WORKSPACE_ID = workspaceId;
  }
  if (workspaceRepoUrl) {
    env.PAPERCLIP_WORKSPACE_REPO_URL = workspaceRepoUrl;
  }
  if (workspaceRepoRef) {
    env.PAPERCLIP_WORKSPACE_REPO_REF = workspaceRepoRef;
  }
  if (workspaceBranch) {
    env.PAPERCLIP_WORKSPACE_BRANCH = workspaceBranch;
  }
  if (workspaceWorktreePath) {
    env.PAPERCLIP_WORKSPACE_WORKTREE_PATH = workspaceWorktreePath;
  }
  if (agentHome) {
    env.AGENT_HOME = agentHome;
  }
  if (workspaceHints.length > 0) {
    env.PAPERCLIP_WORKSPACES_JSON = JSON.stringify(workspaceHints);
  }
  if (runtimeServiceIntents.length > 0) {
    env.PAPERCLIP_RUNTIME_SERVICE_INTENTS_JSON = JSON.stringify(
      runtimeServiceIntents
    );
  }
  if (runtimeServices.length > 0) {
    env.PAPERCLIP_RUNTIME_SERVICES_JSON = JSON.stringify(runtimeServices);
  }
  if (runtimePrimaryUrl) {
    env.PAPERCLIP_RUNTIME_PRIMARY_URL = runtimePrimaryUrl;
  }
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  if (!hasExplicitApiKey && authToken) {
    env.PAPERCLIP_API_KEY = authToken;
  }
  const billingType = resolveCodexBillingType(env);
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(
    runtimeSessionParams.sessionId,
    runtime.sessionId ?? ""
  );
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, "");
  const canResumeSession =
    runtimeSessionId.length > 0 &&
    (runtimeSessionCwd.length === 0 ||
      path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const sessionId = canResumeSession ? runtimeSessionId : null;
  if (runtimeSessionId && !canResumeSession) {
    await onLog(
      "stderr",
      `[paperclip] Codex session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".\n`
    );
  }
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  const instructionsDir = instructionsFilePath
    ? `${path.dirname(instructionsFilePath)}/`
    : "";
  let instructionsPrefix = "";
  let instructionsChars = 0;
  if (instructionsFilePath) {
    try {
      const instructionsContents = await fs.readFile(
        instructionsFilePath,
        "utf8"
      );
      instructionsPrefix =
        `${instructionsContents}\n\n` +
        `The above agent instructions were loaded from ${instructionsFilePath}. ` +
        `Resolve any relative file references from ${instructionsDir}.\n\n`;
      instructionsChars = instructionsPrefix.length;
      await onLog(
        "stdout",
        `[paperclip] Loaded agent instructions file: ${instructionsFilePath}\n`
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await onLog(
        "stderr",
        `[paperclip] Warning: could not read agent instructions file "${instructionsFilePath}": ${reason}\n`
      );
    }
  }
  const commandNotes = (() => {
    if (!instructionsFilePath) return [] as string[];
    if (instructionsPrefix.length > 0) {
      return [
        `Loaded agent instructions from ${instructionsFilePath}`,
        `Prepended instructions + path directive to stdin prompt (relative references from ${instructionsDir}).`,
      ];
    }
    return [
      `Configured instructionsFilePath ${instructionsFilePath}, but file could not be read; continuing without injected instructions.`,
    ];
  })();
  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "");
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrapPrompt =
    !sessionId && bootstrapPromptTemplate.trim().length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const sessionHandoffNote = asString(
    context.paperclipSessionHandoffMarkdown,
    ""
  ).trim();
  const humanFacingLanguageInstruction = asString(
    context.paperclipHumanFacingLanguageInstruction,
    ""
  ).trim();
  const basePromptSections = [
    instructionsPrefix,
    renderedBootstrapPrompt,
    humanFacingLanguageInstruction,
    sessionHandoffNote,
  ];
  const promptMetrics = {
    instructionsChars,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length,
  };

  const buildArgs = (
    resumeSessionId: string | null,
    stagedAttachments: StagedAttachment[]
  ) => {
    const args = ["exec", "--json"];
    if (search) args.unshift("--search");
    if (bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
    if (model) args.push("--model", model);
    if (modelReasoningEffort)
      args.push(
        "-c",
        `model_reasoning_effort=${JSON.stringify(modelReasoningEffort)}`
      );
    for (const attachment of stagedAttachments) {
      if (attachment.kind === "image") {
        args.push("--image", attachment.stagedPath);
      }
    }
    if (extraArgs.length > 0) args.push(...extraArgs);
    if (resumeSessionId) args.push("resume", resumeSessionId, "-");
    else args.push("-");
    return args;
  };

  const apiUrl = asString(env.PAPERCLIP_API_URL, "").trim();
  const apiKey = asString(env.PAPERCLIP_API_KEY, "").trim() || null;
  const markdownNewConvertUrl =
    asString(
      env.PAPERCLIP_MARKDOWNNEW_CONVERT_URL,
      MARKDOWN_NEW_CONVERT_URL
    ).trim() || MARKDOWN_NEW_CONVERT_URL;
  if (attachmentContext.length > 0 && !apiUrl) {
    await onLog(
      "stderr",
      "[paperclip] Attachment inputs were provided but PAPERCLIP_API_URL is missing; continuing without staged attachments.\n"
    );
  }
  if (attachmentContext.length > 0 && !apiKey) {
    await onLog(
      "stderr",
      "[paperclip] Attachment inputs were provided but PAPERCLIP_API_KEY is missing; continuing without staged attachments.\n"
    );
  }
  const { staged: stagedAttachments, stageDir } =
    apiUrl && apiKey && attachmentContext.length > 0
      ? await stageAgentAttachments({
          attachments: attachmentContext,
          cwd,
          runId,
          apiUrl,
          apiKey,
          markdownNewConvertUrl,
          onLog,
        })
      : { staged: [] as StagedAttachment[], stageDir: null as string | null };
  const attachmentPromptSection =
    summarizeAttachmentsForPrompt(stagedAttachments);
  const prompt = joinPromptSections([
    ...basePromptSections,
    attachmentPromptSection,
    renderedPrompt,
  ]);
  const effectivePromptMetrics = {
    ...promptMetrics,
    promptChars: prompt.length,
    attachmentPromptChars: attachmentPromptSection.length,
  };
  const attachmentCommandNotes =
    stagedAttachments.length > 0
      ? [
          `Staged ${stagedAttachments.length} attachment(s) for this run.`,
          ...stagedAttachments.map((attachment) =>
            attachment.kind === "image"
              ? `Attached image "${
                  attachment.originalFilename ??
                  path.basename(attachment.stagedPath)
                }" natively via --image.`
              : attachment.extractedMarkdownPath
              ? `Staged PDF "${
                  attachment.originalFilename ??
                  path.basename(attachment.stagedPath)
                }" locally at ${
                  attachment.stagedPath
                } and converted it to Markdown via markdown.new (${
                  attachment.extractedMarkdownPath
                }).`
              : `Staged PDF "${
                  attachment.originalFilename ??
                  path.basename(attachment.stagedPath)
                }" locally at ${
                  attachment.stagedPath
                }. markdown.new ingestion unavailable${
                  attachment.ingestionFailureReason
                    ? `: ${attachment.ingestionFailureReason}`
                    : ""
                }.`
          ),
        ]
      : [];

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildArgs(resumeSessionId, stagedAttachments);
    if (onMeta) {
      await onMeta({
        adapterType: "codex_local",
        command,
        cwd,
        commandNotes: [...commandNotes, ...attachmentCommandNotes],
        commandArgs: args.map((value, idx) => {
          if (idx === args.length - 1 && value !== "-")
            return `<prompt ${prompt.length} chars>`;
          return value;
        }),
        env: redactEnvForLogs(env),
        prompt,
        promptMetrics: effectivePromptMetrics,
        context:
          stagedAttachments.length > 0
            ? {
                ...context,
                paperclipAttachments: stagedAttachments.map((attachment) => ({
                  id: attachment.id,
                  issueId: attachment.issueId,
                  issueCommentId: attachment.issueCommentId,
                  originalFilename: attachment.originalFilename,
                  contentType: attachment.contentType,
                  byteSize: attachment.byteSize,
                  source: attachment.source,
                  stagedPath: attachment.stagedPath,
                  attachmentKind: attachment.kind,
                  extractedMarkdownPath:
                    attachment.extractedMarkdownPath ?? null,
                  extractedMarkdownCharCount:
                    attachment.extractedMarkdownCharCount ?? null,
                  ingestionMethod: attachment.ingestionMethod ?? null,
                  ingestionFailureReason:
                    attachment.ingestionFailureReason ?? null,
                })),
              }
            : context,
      });
    }

    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env,
      stdin: prompt,
      timeoutSec,
      graceSec,
      onLog: async (stream, chunk) => {
        if (stream !== "stderr") {
          await onLog(stream, chunk);
          return;
        }
        const cleaned = stripCodexRolloutNoise(chunk);
        if (!cleaned.trim()) return;
        await onLog(stream, cleaned);
      },
    });
    const cleanedStderr = stripCodexRolloutNoise(proc.stderr);
    return {
      proc: {
        ...proc,
        stderr: cleanedStderr,
      },
      rawStderr: proc.stderr,
      parsed: parseCodexJsonl(proc.stdout),
    };
  };

  const toResult = (
    attempt: {
      proc: {
        exitCode: number | null;
        signal: string | null;
        timedOut: boolean;
        stdout: string;
        stderr: string;
      };
      rawStderr: string;
      parsed: ReturnType<typeof parseCodexJsonl>;
    },
    clearSessionOnMissingSession = false
  ): AdapterExecutionResult => {
    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        clearSession: clearSessionOnMissingSession,
      };
    }

    const resolvedSessionId =
      attempt.parsed.sessionId ?? runtimeSessionId ?? runtime.sessionId ?? null;
    const resolvedSessionParams = resolvedSessionId
      ? ({
          sessionId: resolvedSessionId,
          cwd,
          ...(workspaceId ? { workspaceId } : {}),
          ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
          ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
        } as Record<string, unknown>)
      : null;
    const parsedError =
      typeof attempt.parsed.errorMessage === "string"
        ? attempt.parsed.errorMessage.trim()
        : "";
    const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
    const fallbackErrorMessage =
      parsedError ||
      stderrLine ||
      `Codex exited with code ${attempt.proc.exitCode ?? -1}`;

    return {
      exitCode: attempt.proc.exitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage:
        (attempt.proc.exitCode ?? 0) === 0 ? null : fallbackErrorMessage,
      usage: attempt.parsed.usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: "openai",
      model,
      billingType,
      costUsd: null,
      resultJson: {
        stdout: attempt.proc.stdout,
        stderr: attempt.proc.stderr,
      },
      summary: attempt.parsed.summary,
      clearSession: Boolean(clearSessionOnMissingSession && !resolvedSessionId),
    };
  };

  try {
    const initial = await runAttempt(sessionId);
    if (
      sessionId &&
      !initial.proc.timedOut &&
      (initial.proc.exitCode ?? 0) !== 0 &&
      isCodexUnknownSessionError(initial.proc.stdout, initial.rawStderr)
    ) {
      await onLog(
        "stderr",
        `[paperclip] Codex resume session "${sessionId}" is unavailable; retrying with a fresh session.\n`
      );
      const retry = await runAttempt(null);
      return toResult(retry, true);
    }

    return toResult(initial);
  } finally {
    if (stageDir) {
      await fs
        .rm(stageDir, { recursive: true, force: true })
        .catch(async (err) => {
          await onLog(
            "stderr",
            `[paperclip] Failed to clean up staged attachments in ${stageDir}: ${
              err instanceof Error ? err.message : String(err)
            }\n`
          );
        });
    }
  }
}
