import { describe, expect, it } from "vitest";
import { computeRetryAt, parseRetryAfterSeconds, selectDueCrawlItems } from "../src/crawl-worker.js";

describe("crawl worker helpers", () => {
  it("enforces per-host concurrency and max attempts", () => {
    const selected = selectDueCrawlItems({
      now: new Date("2026-05-01T00:00:00.000Z"),
      policy: { maxConcurrentRequestsPerHost: 1, minDelayMsPerHost: 2000, maxAttemptsPerUrl: 3 },
      items: [
        { urlId: "1", targetUrl: "https://www.diskinternals.com/a", host: "www.diskinternals.com", attemptCount: 0 },
        { urlId: "2", targetUrl: "https://www.diskinternals.com/b", host: "www.diskinternals.com", attemptCount: 0 },
        { urlId: "3", targetUrl: "https://example.com/c", host: "example.com", attemptCount: 3 },
      ],
    });

    expect(selected.map((item) => item.urlId)).toEqual(["1"]);
  });

  it("honors Retry-After and exponential retry fallback", () => {
    expect(parseRetryAfterSeconds("30")).toBe(30);
    expect(computeRetryAt({
      now: new Date("2026-05-01T00:00:00.000Z"),
      attemptCount: 2,
    })).toBe("2026-05-01T00:00:04.000Z");
  });
});
