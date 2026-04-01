import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  listWorkspaceDirectoryEntries,
  searchWorkspaceFilesByName,
  sanitizeWorkspacePath,
  resolveWorkspace,
  sortFileEntries,
} from "../src/file-browser.js";
import type { FileEntry } from "../src/file-browser-types.js";

function writeFile(filePath: string, content = "x", mtime?: Date) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  if (mtime) {
    fs.utimesSync(filePath, mtime, mtime);
  }
}

describe("file-browser helpers", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-file-browser-"));
    writeFile(path.join(root, "b.txt"), "b", new Date("2026-03-01T10:00:00Z"));
    writeFile(path.join(root, "a.txt"), "a", new Date("2026-03-02T10:00:00Z"));
    writeFile(path.join(root, "nested", "needle.md"), "needle", new Date("2026-03-03T10:00:00Z"));
    writeFile(path.join(root, "nested", "another-note.md"), "another", new Date("2026-03-04T10:00:00Z"));
    writeFile(path.join(root, "nested", "deeper", "Needle-Case.TXT"), "needle", new Date("2026-03-05T10:00:00Z"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("sanitizes workspace paths and resolves inside boundaries", () => {
    expect(sanitizeWorkspacePath(root)).toBe(root);
    expect(sanitizeWorkspacePath("123e4567-e89b-12d3-a456-426614174000")).toBe("");
    expect(resolveWorkspace(root, "nested/needle.md")).toContain("nested/needle.md");
    expect(resolveWorkspace(root, "../outside")).toBeNull();
  });

  it("sorts tree entries by name and includes modifiedAt", () => {
    const entries = listWorkspaceDirectoryEntries(root, undefined, "name", "asc");
    expect(entries.map((entry) => entry.name)).toEqual(["nested", "a.txt", "b.txt"]);
    expect(entries.every((entry) => typeof entry.modifiedAt === "string")).toBe(true);
  });

  it("sorts tree entries by modified time descending", () => {
    const entries = listWorkspaceDirectoryEntries(root, undefined, "modified", "desc");
    expect(entries.map((entry) => entry.name)).toEqual(["nested", "a.txt", "b.txt"]);
  });

  it("searches recursively by filename and is case-insensitive", () => {
    const entries = searchWorkspaceFilesByName(root, "needle", "name", "asc");
    expect(entries.map((entry) => entry.path)).toEqual([
      "nested/deeper/Needle-Case.TXT",
      "nested/needle.md",
    ]);
  });

  it("sorts search results by modified time", () => {
    const entries = searchWorkspaceFilesByName(root, "needle", "modified", "asc");
    expect(entries.map((entry) => entry.name)).toEqual(["needle.md", "Needle-Case.TXT"]);
  });

  it("keeps sort helper deterministic for tree and search modes", () => {
    const sample: FileEntry[] = [
      { name: "z", path: "z", isDirectory: false, modifiedAt: "2026-03-03T00:00:00.000Z" },
      { name: "a", path: "a", isDirectory: true, modifiedAt: "2026-03-02T00:00:00.000Z" },
      { name: "b", path: "b", isDirectory: false, modifiedAt: "2026-03-01T00:00:00.000Z" },
    ];
    expect(sortFileEntries(sample, "name", "asc", "tree").map((entry) => entry.name)).toEqual(["a", "b", "z"]);
    expect(sortFileEntries(sample, "modified", "desc", "search").map((entry) => entry.name)).toEqual(["z", "a", "b"]);
  });
});
