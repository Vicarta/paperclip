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

const costOperationNames = [
  "serper_search_request",
  "dataforseo_content_parsing_request",
  "dataforseo_screenshot_request",
  "serper_scrape_request",
  "llmlayer_scrape_request",
  "llmlayer_proxy_scrape_request",
  "llmlayer_screenshot_request",
  "llmlayer_proxy_screenshot_request",
  "exa_search_request",
  "openai_chat_completion",
] as const;

const costPolicySchema = {
  type: "object",
  properties: {
    currency: { type: "string", enum: ["USD"] },
    operation_rates_usd: {
      type: "object",
      properties: Object.fromEntries(
        costOperationNames.map((name) => [name, { type: "number", minimum: 0 }]),
      ),
      additionalProperties: false,
    },
    pricing_source: { type: "string", minLength: 1 },
    pricing_version: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

export const WINNING_STRUCTURE_TASK_PAYLOAD_SCHEMA = {
  type: "object",
  properties: {
    ...namespaceProperties,
    idempotency_key: { type: "string" },
    input_hash: { type: "string" },
    task: taskSchema,
    market: marketSchema,
    gist_enabled: { type: "boolean", default: true },
    cache_policy: openObjectSchema,
    cost_policy: costPolicySchema,
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
