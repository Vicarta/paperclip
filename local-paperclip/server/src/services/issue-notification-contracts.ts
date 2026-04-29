import type { Db } from "@paperclipai/db";
import type { IssueAttachment, IssueDocument } from "@paperclipai/shared";
import {
  ISSUE_NOTIFICATION_CONTRACT_KEY,
  issueNotificationContractSchema,
  type IssueNotificationAttachmentSelector,
  type IssueNotificationContract,
} from "@paperclipai/shared";
import { documentService } from "./documents.js";
import { issueService } from "./issues.js";

const JSON_FENCE_REGEX = /```json(?:\s+notification-contract)?\s*([\s\S]*?)```/i;

export interface ResolvedIssueNotificationAttachment extends IssueAttachment {
  contentPath: string;
}

export interface ResolvedIssueNotificationContract {
  key: typeof ISSUE_NOTIFICATION_CONTRACT_KEY;
  documentId: string;
  revisionId: string | null;
  contract: IssueNotificationContract;
  attachment: ResolvedIssueNotificationAttachment | null;
  attachments: ResolvedIssueNotificationAttachment[];
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
      if (contract.delivery.mode === "attach_file") {
        const artifactSelector = contract.delivery.artifact;
        resolvedAttachments = attachments
          .filter((candidate) => attachmentMatchesSelector(candidate, artifactSelector))
          .slice(0, 1)
          .map(withContentPath);
      } else {
        resolvedAttachments = contract.delivery.artifacts
          .map((selector) => attachments.find((candidate) => attachmentMatchesSelector(candidate, selector)) ?? null)
          .filter((candidate): candidate is IssueAttachment => candidate !== null)
          .filter((candidate, index, all) => all.findIndex((other) => other.id === candidate.id) === index)
          .map(withContentPath);
      }

      return {
        key: ISSUE_NOTIFICATION_CONTRACT_KEY,
        documentId: document.id,
        revisionId: document.latestRevisionId,
        contract,
        attachment: resolvedAttachments[0] ?? null,
        attachments: resolvedAttachments,
      };
    },
  };
}
