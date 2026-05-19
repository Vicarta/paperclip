import { z } from "zod";

export const ISSUE_NOTIFICATION_CONTRACT_KEY = "notification-contract" as const;

export const issueNotificationChannelSchema = z.enum(["telegram"]);
export const issueNotificationTriggerSchema = z.enum(["issue_done"]);
export const issueNotificationDeliveryModeSchema = z.enum(["attach_file", "attach_files", "delivery_groups"]);
export const issueNotificationAttachmentSourceSchema = z.enum(["issue_attachment"]);
export const issueNotificationRecipientTargetSchema = z.enum(["default_chat", "chat_id", "routing_key"]);

export const issueNotificationAttachmentSelectorSchema = z
  .object({
    source: issueNotificationAttachmentSourceSchema.default("issue_attachment"),
    filenameIncludes: z.string().trim().min(1).max(200).optional(),
    contentTypePrefix: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const issueNotificationDeliveryGroupSchema = z
  .object({
    key: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200).optional(),
    caption: z.string().trim().min(1).max(1000).optional(),
    artifacts: z.array(issueNotificationAttachmentSelectorSchema).min(1).max(5),
  })
  .strict();

export const issueNotificationRecipientSchema = z
  .object({
    target: issueNotificationRecipientTargetSchema.default("default_chat"),
    chatId: z.string().trim().min(1).max(120).optional(),
    routingKey: z.string().trim().min(1).max(120).optional(),
    topicId: z.string().trim().min(1).max(120).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.target === "chat_id" && !value.chatId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chatId"],
        message: "chatId is required when recipient.target is chat_id",
      });
    }
    if (value.target === "routing_key" && !value.routingKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["routingKey"],
        message: "routingKey is required when recipient.target is routing_key",
      });
    }
  });

export const issueNotificationContractSchema = z
  .object({
    version: z.literal(1).default(1),
    enabled: z.boolean().default(true),
    channel: z.literal("telegram"),
    trigger: z.literal("issue_done"),
    delivery: z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.literal("attach_file"),
          artifact: issueNotificationAttachmentSelectorSchema,
        })
        .strict(),
      z
        .object({
          mode: z.literal("attach_files"),
          artifacts: z.array(issueNotificationAttachmentSelectorSchema).min(1).max(5),
        })
        .strict(),
      z
        .object({
          mode: z.literal("delivery_groups"),
          summary: z.string().trim().min(1).max(1000).optional(),
          groups: z.array(issueNotificationDeliveryGroupSchema).min(1).max(100),
        })
        .strict(),
    ]),
    recipient: issueNotificationRecipientSchema.optional(),
  })
  .strict();

export type IssueNotificationAttachmentSelector = z.infer<typeof issueNotificationAttachmentSelectorSchema>;
export type IssueNotificationDeliveryGroup = z.infer<typeof issueNotificationDeliveryGroupSchema>;
export type IssueNotificationRecipient = z.infer<typeof issueNotificationRecipientSchema>;
export type IssueNotificationContract = z.infer<typeof issueNotificationContractSchema>;
