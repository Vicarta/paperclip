const nonEmptyStringSchema = {
  type: "string",
  minLength: 1,
} as const;

const namespaceProperties = {
  company_id: nonEmptyStringSchema,
  project_id: nonEmptyStringSchema,
  client_key: nonEmptyStringSchema,
} as const;

const taskSchema = {
  type: "object",
  properties: {
    keyword_cluster_id: { type: "string" },
    page_mode: { type: "string", enum: ["existing", "new"] },
    target_url: nonEmptyStringSchema,
    primary_keyword: nonEmptyStringSchema,
    auxiliary_keywords: {
      type: "array",
      items: { type: "string" },
    },
    intent_hypothesis: nonEmptyStringSchema,
    content_goal: nonEmptyStringSchema,
  },
  required: [
    "page_mode",
    "target_url",
    "primary_keyword",
    "intent_hypothesis",
    "content_goal",
  ],
  additionalProperties: true,
} as const;

const marketSchema = {
  type: "object",
  properties: {
    geo: nonEmptyStringSchema,
    search_language: nonEmptyStringSchema,
    output_language: nonEmptyStringSchema,
    primary_device: { type: "string", enum: ["desktop", "mobile"] },
  },
  required: ["geo", "search_language", "output_language", "primary_device"],
  additionalProperties: true,
} as const;

const openObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

export const WINNING_STRUCTURE_TASK_PAYLOAD_SCHEMA = {
  type: "object",
  properties: {
    ...namespaceProperties,
    idempotency_key: { type: "string" },
    input_hash: { type: "string" },
    task: taskSchema,
    market: marketSchema,
    cache_policy: openObjectSchema,
    editorial_constraints: {
      type: "array",
      items: { type: "string" },
    },
    current_page_snapshot: openObjectSchema,
    business_context: openObjectSchema,
    ownership_context: openObjectSchema,
    reader_value_policy: openObjectSchema,
  },
  required: [
    "company_id",
    "project_id",
    "client_key",
    "idempotency_key",
    "task",
    "market",
  ],
  additionalProperties: true,
} as const;

export const WINNING_STRUCTURE_RUN_LOOKUP_SCHEMA = {
  type: "object",
  properties: {
    ...namespaceProperties,
    run_id: nonEmptyStringSchema,
  },
  required: ["company_id", "project_id", "client_key", "run_id"],
  additionalProperties: true,
} as const;

export const WINNING_STRUCTURE_DECISION_SCHEMA = {
  type: "object",
  properties: {
    ...namespaceProperties,
    run_id: nonEmptyStringSchema,
    decisions: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: {
        type: "object",
        properties: {
          decision_id: nonEmptyStringSchema,
          decision_version: { type: "integer", minimum: 1 },
          selected_option: nonEmptyStringSchema,
          response: openObjectSchema,
        },
        required: [
          "decision_id",
          "decision_version",
          "selected_option",
          "response",
        ],
        additionalProperties: true,
      },
    },
  },
  required: ["company_id", "project_id", "client_key", "run_id", "decisions"],
  additionalProperties: true,
} as const;

export const TOOL_PARAMETER_SCHEMAS = {
  validateTaskInput: WINNING_STRUCTURE_TASK_PAYLOAD_SCHEMA,
  startRun: WINNING_STRUCTURE_TASK_PAYLOAD_SCHEMA,
  getRunStatus: WINNING_STRUCTURE_RUN_LOOKUP_SCHEMA,
  submitRunDecisions: WINNING_STRUCTURE_DECISION_SCHEMA,
  getRunResult: WINNING_STRUCTURE_RUN_LOOKUP_SCHEMA,
} as const;
