import { describe, expect, it } from "vitest";
import { validateArticleContentV1 } from "../src/article-content.js";

function articleWithSummary(variant: "soft" | "brand" | "situation") {
  return {
    schemaVersion: "articleContent.v1",
    blocks: [
      {
        type: "editorialCallout",
        variant,
        title: "Коротко",
        body: "Стислий нейтральний підсумок для читача.",
      },
    ],
  };
}

describe("canonical summary callout", () => {
  it("accepts the neutral soft variant", () => {
    expect(validateArticleContentV1(articleWithSummary("soft"))).toMatchObject({
      blocks: [{ type: "editorialCallout", variant: "soft", title: "Коротко" }],
    });
  });

  it.each(["brand", "situation"] as const)("rejects %s for the Коротко block", (variant) => {
    expect(() => validateArticleContentV1(articleWithSummary(variant))).toThrow(
      /titled "Коротко" must use variant "soft"/,
    );
  });
});
