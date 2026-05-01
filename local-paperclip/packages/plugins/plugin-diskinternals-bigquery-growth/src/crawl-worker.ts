export type CrawlPolicy = {
  maxConcurrentRequestsPerHost: number;
  minDelayMsPerHost: number;
  maxAttemptsPerUrl: number;
  maxItemsPerTick?: number;
};

export type CrawlItem = {
  urlId: string;
  targetUrl: string;
  host: string;
  attemptCount: number;
  nextFetchAt?: string | null;
};

export function selectDueCrawlItems(input: {
  items: CrawlItem[];
  now: Date;
  policy: CrawlPolicy;
}): CrawlItem[] {
  const selected: CrawlItem[] = [];
  const hostCounts = new Map<string, number>();
  for (const item of input.items) {
    if (item.attemptCount >= input.policy.maxAttemptsPerUrl) continue;
    if (item.nextFetchAt && new Date(item.nextFetchAt).getTime() > input.now.getTime()) continue;
    const count = hostCounts.get(item.host) ?? 0;
    if (count >= input.policy.maxConcurrentRequestsPerHost) continue;
    hostCounts.set(item.host, count + 1);
    selected.push(item);
  }
  return selected;
}

export function computeRetryAt(input: {
  now: Date;
  attemptCount: number;
  retryAfterSeconds?: number | null;
}) {
  if (typeof input.retryAfterSeconds === "number" && input.retryAfterSeconds > 0) {
    return new Date(input.now.getTime() + input.retryAfterSeconds * 1000).toISOString();
  }
  const delayMs = Math.min(60 * 60 * 1000, 2 ** Math.max(0, input.attemptCount) * 1000);
  return new Date(input.now.getTime() + delayMs).toISOString();
}

export function parseRetryAfterSeconds(value: string | null) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(1, Math.ceil((dateMs - Date.now()) / 1000));
  }
  return null;
}
