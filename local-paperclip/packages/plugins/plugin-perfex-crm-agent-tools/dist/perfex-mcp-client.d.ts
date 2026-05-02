import { type PerfexActionType } from "./constants.js";
export type PerfexPluginConfig = {
    perfexMcpTokenSecretRef?: string;
    perfexMcpUrl?: string;
    perfexHealthUrl?: string;
    perfexProjectId?: string;
    projectManagerId?: string;
    assigneeByActionTypeJson?: string;
    createTaskToolName?: string;
    addCommentToolName?: string;
    getTaskToolName?: string;
    getTaskCommentsToolName?: string;
    enableTaskWrites?: boolean;
    defaultDryRun?: boolean;
    statusCheckIntervalMinutes?: number;
    requestTimeoutMs?: number;
};
type FetchLike = typeof fetch;
export type PerfexImplementationTaskInput = {
    action_type?: unknown;
    title?: unknown;
    affected_urls?: unknown;
    requested_changes?: unknown;
    source_evidence?: unknown;
    qa_checklist?: unknown;
    acceptance_criteria?: unknown;
    paperclip_issue_key?: unknown;
    source_opportunity_id?: unknown;
    product_lane?: unknown;
    priority?: unknown;
    indexing_recommendation?: unknown;
    followup_windows?: unknown;
    due_date?: unknown;
    manager_note?: unknown;
};
export type PerfexImplementationTaskPayload = {
    project_id: string;
    project_manager_id: string | null;
    assignee_ids: string[];
    action_type: PerfexActionType;
    title: string;
    description: string;
    priority: string;
    due_date: string | null;
    metadata: {
        company: "DiskInternals";
        paperclip_company_id: "969d66ff-d77e-4dbf-8759-1a17c2bb17c2";
        paperclip_issue_key: string | null;
        source_opportunity_id: string | null;
        affected_urls: string[];
        product_lane: string | null;
        indexing_recommendation: string | null;
        followup_windows: string[];
    };
};
export type PerfexCreateTaskMcpArguments = {
    project_id: string;
    task_name: string;
    description: string;
    assignee_ids: string[];
    follower_ids: string[];
    status: string;
    priority: string;
    start_date: string;
    due_date: string;
    tags: string[];
    created_by: string;
    has_write_permission: true;
};
export type PerfexFollowupDecision = {
    task_id: string;
    perfex_status_text: string | null;
    paperclip_result_status: "implemented" | "verified" | "needs_clarification" | "rejected" | null;
    workflow_state: "in_progress_in_perfex" | "implemented_needs_evidence" | "implemented_pending_verification" | "verified" | "needs_clarification" | "rejected" | "unknown_status";
    changed_urls: string[];
    indexing_eligible: boolean;
    followup_eligible: boolean;
    followup_windows: string[];
    reason: string;
};
export declare function classifyPerfexFollowup(input: {
    taskId: string;
    statusResult: unknown;
    commentsResult: unknown;
    followupWindows?: unknown;
}): PerfexFollowupDecision;
export declare function normalizeConfig(config: PerfexPluginConfig): {
    mcpUrl: string;
    healthUrl: string;
    projectId: string | null;
    projectManagerId: string | null;
    assigneeByActionType: Record<string, string[]>;
    createTaskToolName: string;
    addCommentToolName: string;
    getTaskToolName: string;
    getTaskCommentsToolName: string;
    enableTaskWrites: boolean;
    defaultDryRun: boolean;
    statusCheckIntervalMinutes: number;
    requestTimeoutMs: number;
};
export declare function buildImplementationTaskPayload(input: {
    args?: unknown;
    config: PerfexPluginConfig;
}): PerfexImplementationTaskPayload;
export declare function assertWriteAllowed(input: {
    args?: unknown;
    config: PerfexPluginConfig;
}): {
    allowed: boolean;
    reason: string;
    dryRun: true;
} | {
    allowed: boolean;
    reason: string;
    dryRun: false;
};
export declare function toCreateTaskMcpArguments(payload: PerfexImplementationTaskPayload): PerfexCreateTaskMcpArguments;
export declare function perfexHealthcheck(input: {
    config: PerfexPluginConfig;
    resolveSecret: (secretRef: string) => Promise<string>;
    fetchFn?: FetchLike;
}): Promise<{
    content: string;
    data: {
        ok: boolean;
        status: number;
        url: string;
    };
}>;
export declare function listPerfexMcpTools(input: {
    config: PerfexPluginConfig;
    resolveSecret: (secretRef: string) => Promise<string>;
    fetchFn?: FetchLike;
}): Promise<{
    content: string;
    data: {
        tools: {
            name?: string;
            description?: string;
            inputSchema?: unknown;
        }[];
    };
}>;
export declare function callPerfexMcpTool(input: {
    toolName: string;
    args?: unknown;
    config: PerfexPluginConfig;
    resolveSecret: (secretRef: string) => Promise<string>;
    fetchFn?: FetchLike;
}): Promise<{
    isError: boolean;
    content: string;
    data: {
        structuredContent: {} | null;
        content: unknown[];
    };
}>;
export {};
//# sourceMappingURL=perfex-mcp-client.d.ts.map