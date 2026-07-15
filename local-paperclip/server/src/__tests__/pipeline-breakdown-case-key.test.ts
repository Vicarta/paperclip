import { describe, expect, it } from "vitest";
import { buildBreakdownCaseKey } from "../services/pipelines.js";

describe("pipeline breakdown case keys", () => {
  it("builds a stable cross-parent key when a prefix is configured", () => {
    expect(buildBreakdownCaseKey("article", "human-design-online"))
      .toBe("article:human-design-online");
  });

  it("preserves legacy generated-case behavior without a prefix", () => {
    expect(buildBreakdownCaseKey(null, "human-design-online")).toBeNull();
  });
});
