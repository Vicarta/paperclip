import { describe, expect, it } from "vitest";
import {
  buildWorkspaceArtifactExternalId,
  inferWorkspaceArtifactContentType,
  isPathInsideDirectory,
  normalizeWorkspaceArtifactRelativePath,
} from "../services/workspace-artifact-registration.js";

describe("workspace artifact registration helpers", () => {
  it("normalizes safe workspace-relative paths", () => {
    expect(normalizeWorkspaceArtifactRelativePath(" work\\covers\\image.png ")).toBe("work/covers/image.png");
    expect(normalizeWorkspaceArtifactRelativePath("work/output/../cover.webp")).toBe("work/cover.webp");
  });

  it("rejects absolute and traversal paths", () => {
    expect(() => normalizeWorkspaceArtifactRelativePath("/tmp/cover.png")).toThrow("relativePath must be relative");
    expect(() => normalizeWorkspaceArtifactRelativePath("../secret.txt")).toThrow(
      "relativePath must stay inside the execution workspace",
    );
  });

  it("detects whether real paths stay inside the workspace root", () => {
    expect(isPathInsideDirectory("/workspace/root", "/workspace/root/work/cover.png")).toBe(true);
    expect(isPathInsideDirectory("/workspace/root", "/workspace/root")).toBe(true);
    expect(isPathInsideDirectory("/workspace/root", "/workspace/root-escape/cover.png")).toBe(false);
    expect(isPathInsideDirectory("/workspace/root", "/workspace/secret.txt")).toBe(false);
  });

  it("infers content type and honors explicit normalized content type", () => {
    expect(inferWorkspaceArtifactContentType("cover.PNG")).toBe("image/png");
    expect(inferWorkspaceArtifactContentType("bundle.zip")).toBe("application/zip");
    expect(inferWorkspaceArtifactContentType("cover.bin", " Image/WebP ")).toBe("image/webp");
  });

  it("builds stable non-path external ids for idempotency", () => {
    const first = buildWorkspaceArtifactExternalId("11111111-1111-4111-8111-111111111111", "work/cover.png");
    const second = buildWorkspaceArtifactExternalId("11111111-1111-4111-8111-111111111111", "work/cover.png");
    const other = buildWorkspaceArtifactExternalId("11111111-1111-4111-8111-111111111111", "work/other.png");

    expect(first).toBe(second);
    expect(first).toMatch(/^workspace-artifact:[a-f0-9]{32}$/);
    expect(first).not.toContain("work/cover.png");
    expect(other).not.toBe(first);
  });
});
