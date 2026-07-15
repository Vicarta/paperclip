import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_CONFIG,
  EMAIL_COST_BILLING_TYPE,
  PLUGIN_ID,
  PLUGIN_VERSION,
  TOOL_NAMES,
} from "./constants.js";

const recipientArraySchema = {
  type: "array",
  items: { type: "string" },
} as const;

const developerHandoffPagesSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    properties: {
      url: { type: "string" },
      currentProblem: { type: "string" },
      requiredChanges: { type: "array", items: { type: "string" }, minItems: 1 },
      verification: { type: "array", items: { type: "string" }, minItems: 1 },
    },
    required: ["url", "currentProblem", "requiredChanges", "verification"],
  },
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Email Notifications",
  description:
    "Company-scoped email notification tools with allowlisted recipients, Resend transport, idempotency, delivery proof, and cost accounting.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "plugin.state.read",
    "plugin.state.write",
    "activity.log.write",
    "costs.write",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      resendApiKeySecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Resend API Key Secret Ref",
        description: "Paperclip secret UUID/reference for the Resend API key. Never store the raw key in config.",
        default: DEFAULT_CONFIG.resendApiKeySecretRef,
      },
      resendApiBaseUrl: {
        type: "string",
        title: "Resend API Base URL",
        default: DEFAULT_CONFIG.resendApiBaseUrl,
      },
      fromEmail: {
        type: "string",
        title: "From Email",
        default: DEFAULT_CONFIG.fromEmail,
      },
      defaultRecipientEmails: {
        type: "string",
        title: "Default Recipient Emails",
        description: "Comma-separated concrete default recipients. Astrogen defaults to the owner email.",
        default: DEFAULT_CONFIG.defaultRecipientEmails,
      },
      allowlistedRecipientEmails: {
        type: "string",
        title: "Allowlisted Recipient Emails",
        description: "Comma-separated concrete recipients that agent tools are allowed to address.",
        default: DEFAULT_CONFIG.allowlistedRecipientEmails,
      },
      defaultLanguage: {
        type: "string",
        title: "Default Language",
        default: DEFAULT_CONFIG.defaultLanguage,
      },
      costAccountingMode: {
        type: "string",
        title: "Cost Accounting Mode",
        enum: ["disabled", "estimated_per_email"],
        default: DEFAULT_CONFIG.costAccountingMode,
      },
      estimatedEmailCostUsd: {
        type: "number",
        title: "Estimated Email Cost USD",
        description: `Estimated cost per successful Resend email. Written as ${EMAIL_COST_BILLING_TYPE}.`,
        default: DEFAULT_CONFIG.estimatedEmailCostUsd,
      },
    },
  },
  tools: [
    {
      name: TOOL_NAMES.sendEmailNotification,
      displayName: "Send Email Notification",
      description:
        "Send a concise email notification to explicit allowlisted recipients, or to configured default recipients when recipientEmails is omitted.",
      parametersSchema: {
        type: "object",
        properties: {
          recipientEmails: recipientArraySchema,
          subject: { type: "string" },
          text: { type: "string" },
          html: { type: "string" },
          idempotencyKey: { type: "string" },
          dryRun: { type: "boolean" },
          metadata: { type: "object" },
        },
        required: ["subject", "text"],
      },
    },
    {
      name: TOOL_NAMES.sendChangeReport,
      displayName: "Send Email Change Report",
      description:
        "Send a structured change report after Paperclip process, agent, plugin, or runtime changes. Canonical required fields: summary, changedItems (string[]), backupPath (string), verification (string[]). Include backup and verification evidence.",
      parametersSchema: {
        type: "object",
        properties: {
          recipientEmails: recipientArraySchema,
          subject: { type: "string" },
          summary: { type: "string" },
          changedItems: recipientArraySchema,
          backupPath: { type: "string" },
          verification: recipientArraySchema,
          followUps: recipientArraySchema,
          rollbackNote: { type: "string" },
          idempotencyKey: { type: "string" },
          dryRun: { type: "boolean" },
          metadata: { type: "object" },
        },
        required: ["summary", "changedItems", "backupPath", "verification"],
      },
    },
    {
      name: TOOL_NAMES.sendIncidentReport,
      displayName: "Send Email Incident Report",
      description:
        "Send a structured incident or blocker report to explicit allowlisted recipients, or to configured default recipients.",
      parametersSchema: {
        type: "object",
        properties: {
          recipientEmails: recipientArraySchema,
          subject: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          status: { type: "string" },
          summary: { type: "string" },
          impact: { type: "string" },
          actionNeeded: { type: "string" },
          links: recipientArraySchema,
          idempotencyKey: { type: "string" },
          dryRun: { type: "boolean" },
          metadata: { type: "object" },
        },
        required: ["severity", "status", "summary"],
      },
    },
    {
      name: TOOL_NAMES.sendDeveloperHandoff,
      displayName: "Send Developer Email Handoff",
      description:
        "Send an implementer-ready technical handoff with exact affected URLs, required changes, and verification steps.",
      parametersSchema: {
        type: "object",
        properties: {
          recipientEmails: recipientArraySchema,
          subject: { type: "string" },
          summary: { type: "string" },
          impact: { type: "string" },
          affectedPages: developerHandoffPagesSchema,
          sharedActions: { type: "array", items: { type: "string" }, minItems: 1 },
          sourceIssue: { type: "string" },
          sourceIssueUrl: { type: "string" },
          idempotencyKey: { type: "string" },
          dryRun: { type: "boolean" },
          metadata: { type: "object" },
        },
        required: ["summary", "impact", "affectedPages", "sharedActions", "sourceIssue"],
      },
    },
  ],
};

export default manifest;
