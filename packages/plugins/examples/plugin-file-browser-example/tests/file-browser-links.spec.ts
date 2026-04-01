import { describe, expect, it } from "vitest";
import { buildProjectFilesHref, resolveCompanyRoutePrefix } from "../src/file-browser-links.js";

describe("file browser link helpers", () => {
  it("uses explicit company prefix when available", () => {
    expect(resolveCompanyRoutePrefix("AST", "/issues/AST-99")).toBe("/AST");
    expect(buildProjectFilesHref("project-123", {
      companyPrefix: "AST",
      currentPathname: "/issues/AST-99",
      filePath: "/astrogen/work/doc.md",
    })).toBe(
      "/AST/projects/project-123?tab=plugin%3Apaperclip-file-browser-example%3Afiles-tab&file=%2Fastrogen%2Fwork%2Fdoc.md",
    );
  });

  it("falls back to board prefix from current issue path", () => {
    expect(resolveCompanyRoutePrefix(null, "/AST/issues/AST-99")).toBe("/AST");
    expect(buildProjectFilesHref("db6ccac5-25c7-46b0-a49f-7c614dfe7973", {
      currentPathname: "/AST/issues/AST-99",
      filePath: "/astrogen/work/55-blog-article-briefs/active/blog-article-briefs-money-ua-ast-99-2026-04-01.md",
    })).toBe(
      "/AST/projects/db6ccac5-25c7-46b0-a49f-7c614dfe7973?tab=plugin%3Apaperclip-file-browser-example%3Afiles-tab&file=%2Fastrogen%2Fwork%2F55-blog-article-briefs%2Factive%2Fblog-article-briefs-money-ua-ast-99-2026-04-01.md",
    );
  });

  it("does not invent a board prefix on unscoped routes", () => {
    expect(resolveCompanyRoutePrefix(null, "/projects/project-123")).toBe("");
  });
});

