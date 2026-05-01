import { describe, expect, it } from "vitest";
import { choosePreliminaryAction, pageActionScore, productProxyScore } from "../src/scoring.js";

describe("growth scoring", () => {
  it("excludes Thank You pages from scoring and routing", () => {
    const input = {
      pageType: "thank_you",
      sessions: 10000,
      fileDownloads: 1000,
      visitOrderPage: 500,
      gscImpressions: 100000,
      avgPosition: 8,
    };

    expect(pageActionScore(input)).toBe(0);
    expect(productProxyScore(input)).toBe(0);
    expect(choosePreliminaryAction(input)).toBe("park_no_action");
  });

  it("routes high-impression mid-position URLs to SEO refresh", () => {
    expect(choosePreliminaryAction({ gscImpressions: 5000, avgPosition: 11 })).toBe("seo_refresh");
  });
});
