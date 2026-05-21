const INTERNAL_TITLE_PATTERNS = [
  /\bCTO\b/i,
  /chief technical officer/i,
  /\bstage\s+\d+\b/i,
  /runtime/i,
  /message-?id/i,
  /proof/i,
  /diagnos/i,
  /remediation/i,
  /restore/i,
  /silent[_ -]?noop/i,
  /rerun closeout/i,
  /\bcloseout\b/i,
  /notification-contract/i,
  /telegram delivery/i,
  /delivery proof/i,
  /adapter/i,
  /schema/i,
  /contract/i,
  /validator/i,
  /validation/i,
  /payload draft update/i,
];

const INTERNAL_COMMENT_PATTERNS = [
  /##\s*(result|blocked|rerun closeout|delivery evidence)/i,
  /not restored/i,
  /diagnosis\/routing lane/i,
  /technical diagnosis/i,
  /runtime remediation/i,
  /deterministically/i,
  /blocked until/i,
  /notification-contract/i,
  /message ids?/i,
  /delivery fingerprint/i,
];

export function containsPayloadDraftReadyEvidence(comment: string | null | undefined): boolean {
  if (!comment) return false;
  return (
    /(?:payload|cms).*draft/i.test(comment) &&
    /(?:cover|coverImage|зображення|image)/i.test(comment) &&
    /https:\/\/cms\.astrogen\.com\.ua\/admin\/collections\/blogPosts\//.test(comment)
  );
}

function containsInternalPattern(input: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(input));
}

export function shouldSuppressGenericIssueDoneNotification(input: {
  title?: string | null;
  comment?: string | null;
  hasDeliveryContract?: boolean;
}): boolean {
  if (input.hasDeliveryContract) return true;
  if (containsPayloadDraftReadyEvidence(input.comment)) return false;

  const title = input.title ?? "";
  const comment = input.comment ?? "";
  return containsInternalPattern(title, INTERNAL_TITLE_PATTERNS)
    || containsInternalPattern(comment, INTERNAL_COMMENT_PATTERNS);
}

export function sanitizeIssueDoneComment(comment: string | null | undefined): string | null {
  if (!comment) return null;
  if (shouldSuppressGenericIssueDoneNotification({ comment })) return null;

  const stripped = comment
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) return null;
  return stripped;
}
