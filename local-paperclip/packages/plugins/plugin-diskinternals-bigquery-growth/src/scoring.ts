import { ACTION_TYPES, type ActionType } from "./constants.js";

export type ScoreInput = {
  pageType?: string | null;
  sessions?: number | null;
  fileDownloads?: number | null;
  visitOrderPage?: number | null;
  purchases?: number | null;
  gscImpressions?: number | null;
  gscClicks?: number | null;
  avgPosition?: number | null;
  strategicPriority?: number | null;
};

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function isThankYouPage(pageType: string | null | undefined) {
  return typeof pageType === "string" && /thank[_-]?you/i.test(pageType);
}

export function pageActionScore(input: ScoreInput) {
  if (isThankYouPage(input.pageType)) return 0;
  return Math.round((
    Math.min(n(input.gscImpressions) / 10000, 1) * 25
    + Math.min(n(input.gscClicks) / 1000, 1) * 20
    + Math.min((n(input.fileDownloads) + n(input.visitOrderPage)) / 100, 1) * 20
    + Math.min(n(input.strategicPriority) / 100, 1) * 15
  ) * 100) / 100;
}

export function productProxyScore(input: ScoreInput) {
  if (isThankYouPage(input.pageType)) return 0;
  return Math.round((
    Math.min(n(input.sessions) / 10000, 1) * 30
    + Math.min(n(input.fileDownloads) / 1000, 1) * 25
    + Math.min(n(input.visitOrderPage) / 500, 1) * 20
    + Math.min(n(input.gscImpressions) / 10000, 1) * 15
    + Math.min(n(input.strategicPriority) / 100, 1) * 10
  ) * 100) / 100;
}

export function choosePreliminaryAction(input: ScoreInput): ActionType {
  if (isThankYouPage(input.pageType)) return "park_no_action";
  if (typeof input.avgPosition === "number" && input.avgPosition >= 4 && input.avgPosition <= 20) {
    return "seo_refresh";
  }
  if (n(input.visitOrderPage) > 0 && n(input.fileDownloads) === 0) return "cro_experiment";
  return "park_no_action";
}

export function assertActionType(value: string): asserts value is ActionType {
  if (!(ACTION_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Unsupported opportunity action type: ${value}`);
  }
}
