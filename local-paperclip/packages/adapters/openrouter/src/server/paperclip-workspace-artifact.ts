import { promises as fs } from "node:fs";
import path from "node:path";

function normalizeWorkspaceRoot(root: string | null | undefined) {
  const trimmed = typeof root === "string" ? root.trim() : "";
  if (!trimmed) {
    throw new Error("Paperclip workspace artifact persistence requires an absolute workspace root.");
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`Paperclip workspace root must be absolute: "${trimmed}"`);
  }
  return path.resolve(trimmed);
}

function normalizeRelativeArtifactPath(relativePath: string) {
  const trimmed = relativePath.trim();
  if (!trimmed) {
    throw new Error("Paperclip workspace artifact persistence requires a non-empty relative path.");
  }
  return trimmed;
}

function resolveWithinWorkspace(root: string, relativePath: string) {
  const workspaceRoot = normalizeWorkspaceRoot(root);
  const normalizedRelativePath = normalizeRelativeArtifactPath(relativePath);
  const absoluteTargetPath = path.resolve(workspaceRoot, normalizedRelativePath);
  const relativeToRoot = path.relative(workspaceRoot, absoluteTargetPath);
  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new Error(
      `Paperclip workspace artifact path escapes workspace root: "${normalizedRelativePath}"`,
    );
  }
  return absoluteTargetPath;
}

export async function persistIssueArtifactToWorkspace(input: {
  workspaceRoot: string;
  relativePath: string;
  body: string;
}) {
  const absoluteTargetPath = resolveWithinWorkspace(input.workspaceRoot, input.relativePath);
  await fs.mkdir(path.dirname(absoluteTargetPath), { recursive: true });
  await fs.writeFile(absoluteTargetPath, input.body, "utf8");
  return absoluteTargetPath;
}

