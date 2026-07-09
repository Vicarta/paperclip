const INTERNAL_TITLE_PATTERNS = [
  /\bCTO\b/i,
  /chief technical officer/i,
  /\bstage\s+\d+\b/i,
  /runtime/i,
  /deterministic payload cms draft delivery/i,
  /payload cms draft delivery/i,
  /cms draft delivery/i,
  /delta-?check/i,
  /crawlobserver/i,
  /crawl observer/i,
  /internal page\s*rank/i,
  /internal-?linking plan/i,
  /internal linking plan/i,
  /message-?id/i,
  /proof/i,
  /diagnos/i,
  /remediation/i,
  /restore/i,
  /silent[_ -]?noop/i,
  /rerun closeout/i,
  /\bcloseout\b/i,
  /notification-contract/i,
  /\bHIA\b/i,
  /human escalation/i,
  /owner authorization gate/i,
  /escalation response/i,
  /^\s*\[telegram\]/i,
  /telegram delivery/i,
  /delivery proof/i,
  /adapter/i,
  /schema/i,
  /contract/i,
  /validator/i,
  /validation/i,
  /payload draft update/i,
  /\bseo ops\b/i,
  /\bbrief one approved cadence article\b/i,
  /\bdraft one approved cadence article\b/i,
  /\bvalidate one drafted cadence article\b/i,
  /\bhumanize one accepted cadence article\b/i,
  /\bhumanize accepted seo article\b/i,
  /\bpayload cms draft:.*\bcadence article\b/i,
  /\bbrief catch-up article\b/i,
  /\bdraft catch-up article\b/i,
  /\bvalidate catch-up article\b/i,
  /\brevalidate corrected catch-up article\b/i,
  /\bhumanize catch-up article\b/i,
  /\blayout catch-up article\b/i,
];

const INTERNAL_COMMENT_PATTERNS = [
  /##\s*(result|blocked|manager closeout|rerun closeout|delivery evidence)/i,
  /not restored/i,
  /diagnosis\/routing lane/i,
  /technical diagnosis/i,
  /runtime remediation/i,
  /deterministically/i,
  /blocked until/i,
  /notification-contract/i,
  /\bHIA\b/i,
  /human escalation/i,
  /escalation id/i,
  /matched escalation/i,
  /processed this routed owner reply/i,
  /canonical owner decision/i,
  /canonical source issue/i,
  /recorded the owner decision canonically/i,
  /audit closeout is complete/i,
  /dedup metadata/i,
  /originKind=seo_technical_finding/i,
  /\bstage\s+\d+(?:\.\d+)?\b/i,
  /\bupstream\b/i,
  /\bdownstream\b/i,
  /message ids?/i,
  /delivery fingerprint/i,
  /paperclip needs a disposition before this issue can continue/i,
  /needs a disposition before this issue can continue/i,
  /paperclip could not resolve this issue['’]s missing disposition automatically/i,
  /issue is blocked on a recovery owner/i,
  /\bmissing disposition\b/i,
  /\brecovery owner\b/i,
  /\bpath type:\s*planned execution/i,
  /manager routing update/i,
  /delta-?check result/i,
  /crawlobserver/i,
  /crawl observer/i,
  /internal page\s*rank/i,
  /fresh analyst package/i,
  /rebuilt evidence package/i,
  /allowlisted gsc\/ga4 tool/i,
  /analytics_top_pages/i,
  /url більше не повертає сторінки як прострочені/i,
  /перевірка due url/i,
];

const ASTROGEN_AGENT_ERROR_NOISE_PATTERNS = [
  /monitor:\s*no\s+codex\s+output/i,
  /process adapter missing command/i,
  /adapter missing command/i,
  /openrouter adapter requires openrouter_api_key/i,
  /\bopenrouter_api_key\b/i,
  /^fetch failed$/i,
  /\bnetwork(?:\s+request)?\s+failed\b/i,
  /\beconnreset\b/i,
  /\betimedout\b/i,
  /^terminated$/i,
  /terminated:\s*other side closed/i,
  /\bother side closed\b/i,
  /\bsocket(?:error)?\s*:\s*other side closed\b/i,
  /\bsocket hang up\b/i,
  /\bprocess lost\b/i,
  /server may have restarted/i,
  /paperclip issue artifact upload failed/i,
  /cheap status-only recovery runs cannot update issue documents/i,
  /status-only recovery runs cannot update issue documents/i,
  /cannot update issue documents,\s*plans,\s*or deliverable artifacts/i,
];

const ASTROGEN_PIPELINE_TITLE_PATTERNS = [
  /\bbrief one approved cadence article\b/i,
  /\bdraft one approved cadence article\b/i,
  /\bvalidate one drafted cadence article\b/i,
  /\bhumanize one accepted cadence article\b/i,
  /\bhumanize accepted seo article\b/i,
  /\bpayload cms draft:.*\bcadence article\b/i,
  /\bcms delivery for one accepted cadence article\b/i,
  /\bbrief catch-up article\b/i,
  /\bdraft catch-up article\b/i,
  /\bvalidate catch-up article\b/i,
  /\brevalidate corrected catch-up article\b/i,
  /\bhumanize catch-up article\b/i,
  /\blayout catch-up article\b/i,
];

const INTERNAL_APPROVAL_PATTERNS = [
  /\bCTO\b/i,
  /chief technical officer/i,
  /operator/i,
  /controlled paperclip reload/i,
  /paperclip reload/i,
  /projection smoke/i,
  /pinned-run-target/i,
  /pinned run target/i,
  /invariant/i,
  /regression coverage/i,
  /stage\s+\d+/i,
  /runtime/i,
  /adapter/i,
  /schema/i,
  /contract/i,
  /plugin/i,
  /secret/i,
  /runcontext/i,
  /execute route/i,
  /remediation/i,
  /diagnos/i,
  /technical/i,
  /smoke/i,
];

const OWNER_DECISION_APPROVAL_PATTERNS = [
  /owner/i,
  /власник/i,
  /користувач/i,
  /потрібне рішення/i,
  /потрібна відповідь/i,
  /human decision/i,
  /business decision/i,
  /approval to spend/i,
  /витрат/i,
  /бюджет/i,
  /закуп/i,
  /публікувати/i,
  /опублікувати/i,
];

const INTERNAL_ESCALATION_PATTERNS = [
  /not the .* owner decision request/i,
  /no business decision required/i,
  /diagnostic/i,
  /technical/i,
  /runtime/i,
  /runcontext/i,
  /execute route/i,
  /plugin-tools/i,
  /worker/i,
  /valid runcontext/i,
  /paperclip telegram execute path/i,
  /canonical diagnostic/i,
  /monitor/i,
];

const OWNER_ESCALATION_PATTERNS = [
  /потрібне рішення/i,
  /потрібна відповідь/i,
  /що робити/i,
  /варіанти/i,
  /reply.*1/i,
  /human decision/i,
  /owner decision/i,
  /business decision/i,
];

export function containsPayloadDraftReadyEvidence(comment: string | null | undefined): boolean {
  if (!comment) return false;
  return (
    (/(?:payload|cms).*draft/i.test(comment) || /(?:cms|payload).*чернет/i.test(comment) || /чернет.*(?:cms|payload)/i.test(comment)) &&
    /(?:cover|coverImage|зображення|image)/i.test(comment) &&
    /https:\/\/cms\.astrogen\.com\.ua\/admin\/collections\/blogPosts\//.test(comment)
  );
}

function containsInternalPattern(input: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(input));
}

export function shouldSuppressGenericIssueDoneNotification(input: {
  companyName?: string | null;
  issueIdentifier?: string | null;
  title?: string | null;
  comment?: string | null;
  hasDeliveryContract?: boolean;
}): boolean {
  if (input.hasDeliveryContract) return true;

  const companyName = input.companyName ?? "";
  const issueIdentifier = input.issueIdentifier ?? "";
  const title = input.title ?? "";
  const comment = input.comment ?? "";
  const isAstrogen = companyName.toLowerCase() === "astrogen" || /^AST-\d+\b/i.test(issueIdentifier);
  const hasPayloadDraftReadyEvidence = containsPayloadDraftReadyEvidence(comment);
  if (hasPayloadDraftReadyEvidence && !/deterministic payload cms draft delivery/i.test(title)) {
    return false;
  }

  if (containsInternalPattern(title, INTERNAL_TITLE_PATTERNS)
    || containsInternalPattern(comment, INTERNAL_COMMENT_PATTERNS)) {
    return true;
  }

  if (hasPayloadDraftReadyEvidence) return false;

  if (isAstrogen) {
    return true;
  }

  return false;
}

export function shouldSuppressAgentErrorNotification(input: {
  companyName?: string | null;
  issueIdentifier?: string | null;
  issueTitle?: string | null;
  errorMessage?: string | null;
}): boolean {
  const companyName = input.companyName ?? "";
  const issueIdentifier = input.issueIdentifier ?? "";
  const issueTitle = input.issueTitle ?? "";
  const errorMessage = input.errorMessage ?? "";
  const isAstrogen = companyName.toLowerCase() === "astrogen" || /^AST-\d+\b/i.test(issueIdentifier);
  if (!isAstrogen) return false;

  if (containsInternalPattern(errorMessage, ASTROGEN_AGENT_ERROR_NOISE_PATTERNS)) {
    return true;
  }

  return containsInternalPattern(issueTitle, ASTROGEN_PIPELINE_TITLE_PATTERNS)
    && containsInternalPattern(errorMessage, [
      /adapter/i,
      /provider/i,
      /fetch/i,
      /network/i,
      /missing/i,
      /timeout/i,
      /rate.?limit/i,
    ]);
}

export function shouldSuppressApprovalNotification(input: {
  companyName?: string | null;
  title?: string | null;
  description?: string | null;
  approvalType?: string | null;
  linkedIssueTexts?: string[];
}): boolean {
  const companyName = input.companyName ?? "";
  if (companyName.toLowerCase() !== "astrogen") return false;

  const haystack = [
    input.title ?? "",
    input.description ?? "",
    input.approvalType ?? "",
    ...(input.linkedIssueTexts ?? []),
  ].join("\n");

  const ownerDecision = containsInternalPattern(haystack, OWNER_DECISION_APPROVAL_PATTERNS);
  const internal = containsInternalPattern(haystack, INTERNAL_APPROVAL_PATTERNS);

  if (internal && !ownerDecision) return true;

  return false;
}

export function shouldSuppressHumanEscalationNotification(input: {
  companyName?: string | null;
  reason?: string | null;
  conversationSummary?: string | null;
  suggestedActions?: string[];
  suggestedReply?: string | null;
}): boolean {
  const companyName = input.companyName ?? "";
  if (companyName.toLowerCase() !== "astrogen") return false;

  const haystack = [
    input.reason ?? "",
    input.conversationSummary ?? "",
    input.suggestedReply ?? "",
    ...(input.suggestedActions ?? []),
  ].join("\n");

  const ownerDecision = containsInternalPattern(haystack, OWNER_ESCALATION_PATTERNS);
  const internal = containsInternalPattern(haystack, INTERNAL_ESCALATION_PATTERNS);

  if (/not the .* owner decision request/i.test(haystack)) return true;
  if (internal && !ownerDecision) return true;

  return false;
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
