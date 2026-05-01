import { describe, expect, it } from "vitest";
import { normalizeDiskInternalsUrl } from "../src/url-normalization.js";

describe("normalizeDiskInternalsUrl", () => {
  it("canonicalizes DiskInternals URLs and removes tracking parameters", () => {
    const normalized = normalizeDiskInternalsUrl(
      "http://diskinternals.com/vmfs-recovery/index.html/?utm_source=x&b=2&a=1#section",
    );

    expect(normalized.normalizedUrl).toBe("https://www.diskinternals.com/vmfs-recovery?a=1&b=2");
    expect(normalized.queryParametersRemoved).toEqual(["utm_source"]);
    expect(normalized.queryParametersKept).toEqual(["a", "b"]);
    expect(normalized.urlId).toHaveLength(24);
  });
});
