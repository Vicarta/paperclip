import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { persistIssueArtifactToWorkspace } from "./paperclip-workspace-artifact.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspaceRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-openrouter-artifact-"));
  tempDirs.push(dir);
  return dir;
}

describe("persistIssueArtifactToWorkspace", () => {
  it("writes the artifact body inside the workspace root", async () => {
    const workspaceRoot = makeWorkspaceRoot();
    const writtenPath = await persistIssueArtifactToWorkspace({
      workspaceRoot,
      relativePath: "work/59-seo-blog-article-drafts/active/ast-459-money.md",
      body: "# Draft\n\nHello\n",
    });

    expect(writtenPath).toBe(
      path.join(workspaceRoot, "work/59-seo-blog-article-drafts/active/ast-459-money.md"),
    );
    expect(fs.readFileSync(writtenPath, "utf8")).toBe("# Draft\n\nHello\n");
  });

  it("rejects artifact paths that escape the workspace", async () => {
    const workspaceRoot = makeWorkspaceRoot();

    await expect(
      persistIssueArtifactToWorkspace({
        workspaceRoot,
        relativePath: "../outside.md",
        body: "bad\n",
      }),
    ).rejects.toThrow(/escapes workspace root/i);
  });
});

