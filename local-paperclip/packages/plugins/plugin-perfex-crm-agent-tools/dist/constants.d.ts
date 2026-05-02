export declare const PLUGIN_ID = "paperclip.perfex-crm-agent-tools";
export declare const PLUGIN_VERSION = "0.1.0";
export declare const DEFAULT_PERFEX_MCP_URL = "https://pxmc.aibizmate.com/mcp";
export declare const DEFAULT_PERFEX_HEALTH_URL = "https://pxmc.aibizmate.com/healthz";
export declare const SLOT_IDS: {
    readonly settingsPage: "perfex-crm-agent-tools-settings-page";
};
export declare const EXPORT_NAMES: {
    readonly settingsPage: "PerfexCrmSettingsPage";
};
export declare const PERFEX_ACTION_TYPES: readonly ["seo_refresh", "new_page_or_article", "product_page_update", "internal_linking", "cro_experiment", "localization_experiment", "indexing_followup", "tracking_or_data_quality_issue"];
export type PerfexActionType = (typeof PERFEX_ACTION_TYPES)[number];
export declare const PERFEX_ACTION_TYPE_ALIASES: Record<string, PerfexActionType>;
export declare const TOOL_NAMES: {
    readonly healthcheck: "perfex-healthcheck";
    readonly listTools: "perfex-list-tools";
    readonly previewImplementationTask: "perfex-preview-implementation-task";
    readonly createImplementationTask: "perfex-create-implementation-task";
    readonly addTaskComment: "perfex-add-task-comment";
    readonly getTaskStatus: "perfex-get-task-status";
    readonly getTaskComments: "perfex-get-task-comments";
    readonly syncTaskStatus: "perfex-sync-task-status";
};
export declare const ENTITY_TYPES: {
    readonly implementationTask: "perfex-implementation-task";
    readonly taskComment: "perfex-task-comment";
    readonly taskStatus: "perfex-task-status";
};
//# sourceMappingURL=constants.d.ts.map