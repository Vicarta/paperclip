export const PLUGIN_ID = "paperclip.semantic-core-mcp-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_SEMANTIC_CORE_MCP_URL = "http://100.98.5.50:8001/mcp";
export const PAPERCLIP_IMPORT_SCHEMA_VERSION = "paperclip_import.v1";

export const SLOT_IDS = {
  settingsPage: "semantic-core-mcp-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "SemanticCoreMcpSettingsPage",
} as const;

export const SEMANTIC_LAYERS = [
  "core_product_intent",
  "adjacent_use_case_intent",
  "audience_need_intent",
  "audience_interest_intent",
] as const;

export type SemanticLayer = (typeof SEMANTIC_LAYERS)[number];

export const MCP_TOOL_NAMES = [
  "get_paperclip_import_schema",
  "register_project",
  "run_layer",
  "get_job_status",
  "prepare_paperclip_import",
  "get_review_queue",
  "submit_review_decisions",
] as const;

export type SemanticCoreMcpToolName = (typeof MCP_TOOL_NAMES)[number];

export const TOOL_NAMES = {
  listTools: "list-tools",
  getPaperclipImportSchema: "get-paperclip-import-schema",
  registerProject: "register-project",
  runLayer: "run-layer",
  runLayerAndWait: "run-layer-and-wait",
  getJobStatus: "get-job-status",
  preparePaperclipImport: "prepare-paperclip-import",
  getReviewQueue: "get-review-queue",
  submitReviewDecisions: "submit-review-decisions",
  smokeTest: "smoke-test",
} as const;

export const ENTITY_TYPES = {
  projectRegistration: "semantic-core-project-registration",
  layerRun: "semantic-core-layer-run",
  importCandidate: "semantic-core-import-candidate",
  reviewDecisionBatch: "semantic-core-review-decision-batch",
  smokeTest: "semantic-core-smoke-test",
} as const;
