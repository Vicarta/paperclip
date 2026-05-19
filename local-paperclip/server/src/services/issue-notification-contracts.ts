import type { Db } from "@paperclipai/db";
import type { IssueAttachment, IssueDocument } from "@paperclipai/shared";
import {
  ISSUE_NOTIFICATION_CONTRACT_KEY,
  issueNotificationContractSchema,
  type IssueNotificationAttachmentSelector,
  type IssueNotificationContract,
  type IssueNotificationDeliveryGroup,
} from "@paperclipai/shared";
import { documentService } from "./documents.js";
import { issueService } from "./issues.js";

const JSON_FENCE_REGEX = /```json(?:\s+notification-contract)?\s*([\s\S]*?)```/i;

export interface ResolvedIssueNotificationAttachment extends IssueAttachment {
  contentPath: string;
}

export interface ResolvedIssueNotificationAttachmentGroup {
  key: string;
  title: string | null;
  caption: string | null;
  attachments: ResolvedIssueNotificationAttachment[];
  missingSelectors: IssueNotificationAttachmentSelector[];
}

export interface ResolvedIssueNotificationContract {
  key: typeof ISSUE_NOTIFICATION_CONTRACT_KEY;
  documentId: string;
  revisionId: string | null;
  contract: IssueNotificationContract;
  attachment: ResolvedIssueNotificationAttachment | null;
  attachments: ResolvedIssueNotificationAttachment[];
  attachmentGroups: ResolvedIssueNotificationAttachmentGroup[];
}

export function extractIssueNotificationContractJson(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const match = body.match(JSON_FENCE_REGEX);
  return match?.[1]?.trim() || null;
}

export function parseIssueNotificationContractDocument(document: { body?: string | null }): IssueNotificationContract {
  if (typeof document.body !== "string") {
    throw new Error("Notification contract document body is missing.");
  }
  const json = extractIssueNotificationContractJson(document.body);
  if (!json) {
    throw new Error("Notification contract document must contain a JSON object or a fenced ```json``` block.");
  }
  const parsed = JSON.parse(json);
  return issueNotificationContractSchema.parse(parsed);
}

function attachmentMatchesSelector(
  attachment: Pick<IssueAttachment, "originalFilename" | "contentType">,
  selector: IssueNotificationAttachmentSelector,
): boolean {
  const filename = attachment.originalFilename ?? "";
  if (selector.filenameIncludes && !filename.includes(selector.filenameIncludes)) {
    return false;
  }
  if (selector.contentTypePrefix && !attachment.contentType.startsWith(selector.contentTypePrefix)) {
    return false;
  }
  return true;
}

function withContentPath(attachment: Omit<IssueAttachment, "contentPath">): ResolvedIssueNotificationAttachment {
  return {
    ...attachment,
    contentPath: `/api/attachments/${attachment.id}/content`,
  };
}

function resolveSelectors(
  attachments: Omit<IssueAttachment, "contentPath">[],
  selectors: IssueNotificationAttachmentSelector[],
): {
  attachments: ResolvedIssueNotificationAttachment[];
  missingSelectors: IssueNotificationAttachmentSelector[];
} {
  const resolved: Omit<IssueAttachment, "contentPath">[] = [];
  const missingSelectors: IssueNotificationAttachmentSelector[] = [];

  for (const selector of selectors) {
    const match = attachments.find((candidate) => attachmentMatchesSelector(candidate, selector)) ?? null;
    if (!match) {
      missingSelectors.push(selector);
      continue;
    }
    if (!resolved.some((candidate) => candidate.id === match.id)) {
      resolved.push(match);
    }
  }

  return {
    attachments: resolved.map(withContentPath),
    missingSelectors,
  };
}

function resolveDeliveryGroup(
  attachments: Omit<IssueAttachment, "contentPath">[],
  group: IssueNotificationDeliveryGroup,
): ResolvedIssueNotificationAttachmentGroup {
  const resolved = resolveSelectors(attachments, group.artifacts);
  return {
    key: group.key,
    title: group.title ?? null,
    caption: group.caption ?? null,
    attachments: resolved.attachments,
    missingSelectors: resolved.missingSelectors,
  };
}

export function issueNotificationContractService(db: Db) {
  const documentsSvc = documentService(db);
  const issuesSvc = issueService(db);

  return {
    async getForIssue(issueId: string): Promise<ResolvedIssueNotificationContract | null> {
      const document = await documentsSvc.getIssueDocumentByKey(issueId, ISSUE_NOTIFICATION_CONTRACT_KEY);
      if (!document) return null;

      const contract = parseIssueNotificationContractDocument(document);
      const attachments = await issuesSvc.listAttachments(issueId);
      let resolvedAttachments: ResolvedIssueNotificationAttachment[];
      let attachmentGroups: ResolvedIssueNotificationAttachmentGroup[] = [];
      if (contract.delivery.mode === "attach_file") {
        const artifactSelector = contract.delivery.artifact;
        resolvedAttachments = attachments
          .filter((candidate) => attachmentMatchesSelector(candidate, artifactSelector))
          .slice(0, 1)
          .map(withContentPath);
      } else if (contract.delivery.mode === "attach_files") {
        resolvedAttachments = resolveSelectors(attachments, contract.delivery.artifacts).attachments;
      } else {
        attachmentGroups = contract.delivery.groups.map((group) => resolveDeliveryGroup(attachments, group));
        resolvedAttachments = attachmentGroups
          .flatMap((group) => group.attachments)
          .filter((attachment, index, all) => all.findIndex((other) => other.id === attachment.id) === index);
      }

      return {
        key: ISSUE_NOTIFICATION_CONTRACT_KEY,
        documentId: document.id,
        revisionId: document.latestRevisionId,
        contract,
        attachment: resolvedAttachments[0] ?? null,
        attachments: resolvedAttachments,
        attachmentGroups,
      };
    },
  };
}
