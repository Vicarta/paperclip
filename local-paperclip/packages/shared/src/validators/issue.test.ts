import { describe, expect, it } from "vitest";
import { createIssueSchema, updateIssueSchema } from "./issue.js";

describe("issue validators", () => {
  it("preserves SEO technical origin metadata on create and update payloads", () => {
    const originKind = "seo_technical_finding";
    const originId = "https://example.test/blog/post/::noindex";
    const originRunId = "gsc-audit-2026-06-03";

    const created = createIssueSchema.parse({
      title: "Fix published blog noindex",
      status: "todo",
      originKind,
      originId,
      originRunId,
    });

    expect(created).toMatchObject({ originKind, originId, originRunId });

    const updated = updateIssueSchema.parse({
      originKind,
      originId,
      originRunId,
    });

    expect(updated).toMatchObject({ originKind, originId, originRunId });
  });
});
