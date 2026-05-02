import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DEFAULT_PERFEX_HEALTH_URL, DEFAULT_PERFEX_MCP_URL, PERFEX_ACTION_TYPE_ALIASES, PERFEX_ACTION_TYPES, PLUGIN_ID, PLUGIN_VERSION, } from "./constants.js";
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function readString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function readPositiveNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : null;
}
function readStringArray(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => readString(entry)).filter((entry) => Boolean(entry));
    }
    const direct = readString(value);
    if (!direct)
        return [];
    return direct
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function stringifyForSearch(value) {
    if (typeof value === "string")
        return value.replace(/\\n/g, "\n");
    try {
        return JSON.stringify(value ?? "", null, 2).replace(/\\n/g, "\n");
    }
    catch {
        return String(value ?? "").replace(/\\n/g, "\n");
    }
}
function extractPerfexStatusText(value) {
    if (!isRecord(value))
        return null;
    const structured = isRecord(value.structuredContent) ? value.structuredContent : null;
    const directCandidates = [
        value.status,
        value.task_status,
        value.name,
        structured?.status,
        structured?.task_status,
        structured?.name,
    ];
    for (const candidate of directCandidates) {
        const text = readString(candidate);
        if (text)
            return text;
    }
    const haystack = stringifyForSearch(value);
    const match = haystack.match(/"status"\\s*:\\s*"([^"]+)"/i);
    return match?.[1]?.trim() || null;
}
function extractPaperclipResultStatus(text) {
    const match = text.match(/(?:paperclip\s+result[\s\S]{0,250}?)?status\s*:\s*(implemented|verified|needs[_ -]clarification|rejected)\b/i);
    if (!match)
        return null;
    const normalized = match[1].toLowerCase().replace(/[- ]/g, "_");
    if (normalized === "needs_clarification")
        return "needs_clarification";
    if (normalized === "implemented" || normalized === "verified" || normalized === "rejected") {
        return normalized;
    }
    return null;
}
function extractChangedUrls(text) {
    const urls = text.match(/https?:\/\/[^\s)\]>"]+/g) ?? [];
    return Array.from(new Set(urls.map((url) => url.replace(/[.,;:]+$/, ""))));
}
export function classifyPerfexFollowup(input) {
    const statusText = extractPerfexStatusText(input.statusResult);
    const commentsText = stringifyForSearch(input.commentsResult);
    const resultStatus = extractPaperclipResultStatus(commentsText);
    const changedUrls = extractChangedUrls(commentsText);
    const followupWindows = readStringArray(input.followupWindows);
    if (resultStatus === "verified") {
        return {
            task_id: input.taskId,
            perfex_status_text: statusText,
            paperclip_result_status: resultStatus,
            workflow_state: "verified",
            changed_urls: changedUrls,
            indexing_eligible: changedUrls.length > 0,
            followup_eligible: changedUrls.length > 0,
            followup_windows: followupWindows.length > 0 ? followupWindows : ["7 days", "14 days", "28 days"],
            reason: changedUrls.length > 0
                ? "Human result is verified and includes changed URLs."
                : "Human result is verified but changed URLs are missing, so follow-up is parked.",
        };
    }
    if (resultStatus === "implemented") {
        return {
            task_id: input.taskId,
            perfex_status_text: statusText,
            paperclip_result_status: resultStatus,
            workflow_state: "implemented_pending_verification",
            changed_urls: changedUrls,
            indexing_eligible: false,
            followup_eligible: false,
            followup_windows: followupWindows,
            reason: "Human result says implemented, but Paperclip verification is still required before indexing or telemetry follow-up.",
        };
    }
    if (resultStatus === "needs_clarification" || resultStatus === "rejected") {
        return {
            task_id: input.taskId,
            perfex_status_text: statusText,
            paperclip_result_status: resultStatus,
            workflow_state: resultStatus,
            changed_urls: changedUrls,
            indexing_eligible: false,
            followup_eligible: false,
            followup_windows: [],
            reason: `Human result is ${resultStatus}; do not start indexing or follow-up.`,
        };
    }
    const completedByPerfexOnly = statusText ? /done|complete|completed|closed|finished/i.test(statusText) : false;
    if (completedByPerfexOnly) {
        return {
            task_id: input.taskId,
            perfex_status_text: statusText,
            paperclip_result_status: null,
            workflow_state: "implemented_needs_evidence",
            changed_urls: changedUrls,
            indexing_eligible: false,
            followup_eligible: false,
            followup_windows: [],
            reason: "Perfex status looks complete, but no structured Paperclip result comment was found.",
        };
    }
    if (statusText) {
        return {
            task_id: input.taskId,
            perfex_status_text: statusText,
            paperclip_result_status: null,
            workflow_state: "in_progress_in_perfex",
            changed_urls: changedUrls,
            indexing_eligible: false,
            followup_eligible: false,
            followup_windows: [],
            reason: "Perfex task is not verified complete.",
        };
    }
    return {
        task_id: input.taskId,
        perfex_status_text: null,
        paperclip_result_status: null,
        workflow_state: "unknown_status",
        changed_urls: changedUrls,
        indexing_eligible: false,
        followup_eligible: false,
        followup_windows: [],
        reason: "Perfex status could not be normalized; park for OPS/CTO review.",
    };
}
function parseAssigneeMap(value) {
    const raw = readString(value) ?? "{}";
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed))
            return {};
        const result = {};
        for (const [key, entry] of Object.entries(parsed)) {
            const actionType = normalizeActionType(key);
            if (!actionType)
                continue;
            const ids = readStringArray(entry);
            if (ids.length > 0)
                result[actionType] = ids;
        }
        return result;
    }
    catch {
        return {};
    }
}
export function normalizeConfig(config) {
    return {
        mcpUrl: readString(config.perfexMcpUrl) ?? DEFAULT_PERFEX_MCP_URL,
        healthUrl: readString(config.perfexHealthUrl) ?? DEFAULT_PERFEX_HEALTH_URL,
        projectId: readString(config.perfexProjectId),
        projectManagerId: readString(config.projectManagerId),
        assigneeByActionType: parseAssigneeMap(config.assigneeByActionTypeJson),
        createTaskToolName: readString(config.createTaskToolName) ?? "create_task",
        addCommentToolName: readString(config.addCommentToolName) ?? "add_task_comment",
        getTaskToolName: readString(config.getTaskToolName) ?? "get_task",
        getTaskCommentsToolName: readString(config.getTaskCommentsToolName) ?? "get_task_comments",
        enableTaskWrites: config.enableTaskWrites === true,
        defaultDryRun: config.defaultDryRun !== false,
        statusCheckIntervalMinutes: readPositiveNumber(config.statusCheckIntervalMinutes) ?? 60,
        requestTimeoutMs: readPositiveNumber(config.requestTimeoutMs) ?? 60_000,
    };
}
function normalizeActionType(value) {
    const candidate = readString(value);
    if (!candidate)
        return null;
    const alias = PERFEX_ACTION_TYPE_ALIASES[candidate];
    if (alias)
        return alias;
    return PERFEX_ACTION_TYPES.includes(candidate)
        ? candidate
        : null;
}
function requireConfiguredProjectId(projectId) {
    if (!projectId) {
        throw new Error("Perfex project ID is not configured. Do not create implementation tasks until the approved project is set.");
    }
    return projectId;
}
function section(title, body) {
    const lines = Array.isArray(body) ? body : [body];
    const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
    if (nonEmpty.length === 0)
        return "";
    return `## ${title}\n${nonEmpty.join("\n")}`;
}
export function buildImplementationTaskPayload(input) {
    if (!isRecord(input.args)) {
        throw new Error("Perfex implementation task input must be an object");
    }
    const config = normalizeConfig(input.config);
    const actionType = normalizeActionType(input.args.action_type);
    if (!actionType) {
        throw new Error(`action_type must be one of: ${PERFEX_ACTION_TYPES.join(", ")}`);
    }
    const projectId = requireConfiguredProjectId(config.projectId);
    const title = readString(input.args.title);
    if (!title)
        throw new Error("title is required");
    const requestedChanges = readString(input.args.requested_changes);
    if (!requestedChanges)
        throw new Error("requested_changes is required");
    const affectedUrls = readStringArray(input.args.affected_urls);
    if (affectedUrls.length === 0)
        throw new Error("affected_urls must contain at least one URL");
    const qaChecklist = readStringArray(input.args.qa_checklist);
    if (qaChecklist.length === 0)
        throw new Error("qa_checklist must contain at least one item");
    const acceptanceCriteria = readStringArray(input.args.acceptance_criteria);
    if (acceptanceCriteria.length === 0) {
        throw new Error("acceptance_criteria must contain at least one item");
    }
    const sourceEvidence = readString(input.args.source_evidence) ?? "Source evidence was not provided.";
    const followupWindows = readStringArray(input.args.followup_windows);
    const priority = readString(input.args.priority) ?? "medium";
    const productLane = readString(input.args.product_lane);
    const indexingRecommendation = readString(input.args.indexing_recommendation);
    const paperclipIssueKey = readString(input.args.paperclip_issue_key);
    const sourceOpportunityId = readString(input.args.source_opportunity_id);
    const dueDate = readString(input.args.due_date);
    const managerNote = readString(input.args.manager_note);
    const assigneeIds = config.assigneeByActionType[actionType] ?? [];
    const description = [
        section("Affected URLs", affectedUrls.map((url) => `- ${url}`)),
        section("Requested Changes", requestedChanges),
        section("Source Evidence", sourceEvidence),
        section("QA Checklist", qaChecklist.map((item) => `- ${item}`)),
        section("Acceptance Criteria", acceptanceCriteria.map((item) => `- ${item}`)),
        section("Indexing Recommendation", indexingRecommendation ?? "Not specified"),
        section("Follow-Up", followupWindows.length > 0 ? followupWindows.map((item) => `- ${item}`) : "Not specified"),
        section("Paperclip Reference", [
            paperclipIssueKey ? `- Issue: ${paperclipIssueKey}` : "",
            sourceOpportunityId ? `- Opportunity: ${sourceOpportunityId}` : "",
            productLane ? `- Product lane: ${productLane}` : "",
        ]),
        section("Manager Note", managerNote ?? ""),
    ].filter(Boolean).join("\n\n");
    return {
        project_id: projectId,
        project_manager_id: config.projectManagerId,
        assignee_ids: assigneeIds,
        action_type: actionType,
        title,
        description,
        priority,
        due_date: dueDate,
        metadata: {
            company: "DiskInternals",
            paperclip_company_id: "969d66ff-d77e-4dbf-8759-1a17c2bb17c2",
            paperclip_issue_key: paperclipIssueKey,
            source_opportunity_id: sourceOpportunityId,
            affected_urls: affectedUrls,
            product_lane: productLane,
            indexing_recommendation: indexingRecommendation,
            followup_windows: followupWindows,
        },
    };
}
function shouldDryRun(args, config) {
    if (isRecord(args) && typeof args.dry_run === "boolean")
        return args.dry_run;
    return config.defaultDryRun;
}
export function assertWriteAllowed(input) {
    const config = normalizeConfig(input.config);
    const dryRun = shouldDryRun(input.args, config);
    if (dryRun)
        return { allowed: false, reason: "dry_run", dryRun };
    if (!config.enableTaskWrites) {
        return { allowed: false, reason: "writes_disabled", dryRun };
    }
    return { allowed: true, reason: "enabled", dryRun };
}
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
export function toCreateTaskMcpArguments(payload) {
    if (payload.assignee_ids.length === 0) {
        throw new Error("Perfex assignee_ids are required before task writes can be enabled");
    }
    if (!payload.project_manager_id) {
        throw new Error("Perfex project_manager_id is required before task writes can be enabled");
    }
    if (!payload.due_date) {
        throw new Error("due_date is required before writing a Perfex task");
    }
    return {
        project_id: payload.project_id,
        task_name: payload.title,
        description: payload.description,
        assignee_ids: payload.assignee_ids,
        follower_ids: [payload.project_manager_id],
        status: "1",
        priority: payload.priority,
        start_date: todayIsoDate(),
        due_date: payload.due_date,
        tags: [
            "Paperclip",
            "DiskInternals",
            payload.action_type,
            payload.metadata.paperclip_issue_key ?? "",
        ].filter(Boolean),
        created_by: payload.project_manager_id,
        has_write_permission: true,
    };
}
async function resolveToken(input) {
    const secretRef = readString(input.config.perfexMcpTokenSecretRef);
    if (!secretRef)
        throw new Error("Perfex MCP token secret is not configured");
    const token = await input.resolveSecret(secretRef);
    const normalized = readString(token);
    if (!normalized)
        throw new Error("Perfex MCP token secret resolved to an empty value");
    return normalized;
}
async function withClient(input) {
    const normalized = normalizeConfig(input.config);
    const token = await resolveToken(input);
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), normalized.requestTimeoutMs);
    const transport = new StreamableHTTPClientTransport(new URL(normalized.mcpUrl), {
        requestInit: {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
            },
            signal: abortController.signal,
        },
        fetch: input.fetchFn,
    });
    const client = new Client({ name: PLUGIN_ID, version: PLUGIN_VERSION }, { capabilities: {} });
    try {
        await client.connect(transport);
        return await input.run(client, normalized);
    }
    finally {
        clearTimeout(timeout);
        await client.close().catch(() => undefined);
    }
}
function normalizeMcpResult(result) {
    const text = Array.isArray(result.content)
        ? result.content
            .map((item) => isRecord(item) && typeof item.text === "string" ? item.text : "")
            .filter(Boolean)
            .join("\n")
        : "";
    return {
        isError: result.isError === true,
        content: text || JSON.stringify(result.structuredContent ?? result.content ?? {}, null, 2),
        data: {
            structuredContent: result.structuredContent ?? null,
            content: result.content ?? [],
        },
    };
}
export async function perfexHealthcheck(input) {
    const normalized = normalizeConfig(input.config);
    const token = await resolveToken(input);
    const fetchImpl = input.fetchFn ?? fetch;
    const response = await fetchImpl(normalized.healthUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
    });
    return {
        content: JSON.stringify({
            ok: response.ok,
            status: response.status,
            url: normalized.healthUrl,
        }, null, 2),
        data: {
            ok: response.ok,
            status: response.status,
            url: normalized.healthUrl,
        },
    };
}
export async function listPerfexMcpTools(input) {
    return await withClient({
        ...input,
        async run(client) {
            const result = await client.listTools();
            const tools = Array.isArray(result.tools) ? result.tools : [];
            return {
                content: JSON.stringify(tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description ?? "",
                    inputSchema: tool.inputSchema ?? null,
                })), null, 2),
                data: { tools },
            };
        },
    });
}
export async function callPerfexMcpTool(input) {
    return await withClient({
        config: input.config,
        resolveSecret: input.resolveSecret,
        fetchFn: input.fetchFn,
        async run(client) {
            const result = await client.callTool({
                name: input.toolName,
                arguments: isRecord(input.args) ? input.args : {},
            });
            return normalizeMcpResult(result);
        },
    });
}
//# sourceMappingURL=perfex-mcp-client.js.map