import { createHash } from "node:crypto";
import path from "node:path";
import { unprocessable } from "../errors.js";
import { normalizeContentType } from "../attachment-types.js";

export function normalizeWorkspaceArtifactRelativePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw unprocessable("relativePath is required");
  if (path.isAbsolute(trimmed)) {
    throw unprocessable("relativePath must be relative", { code: "invalid_workspace_artifact_path" });
  }
  const normalized = path.posix.normalize(trimmed.replace(/\\/g, "/"));
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw unprocessable("relativePath must stay inside the execution workspace", {
      code: "invalid_workspace_artifact_path",
    });
  }
  return normalized;
}

export function isPathInsideDirectory(rootRealPath: string, childRealPath: string): boolean {
  const relative = path.relative(rootRealPath, childRealPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function inferWorkspaceArtifactContentType(filename: string, explicitContentType?: string | null): string {
  if (explicitContentType?.trim()) return normalizeContentType(explicitContentType);
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export function buildWorkspaceArtifactExternalId(executionWorkspaceId: string, relativePath: string): string {
  const digest = createHash("sha256")
    .update(`${executionWorkspaceId}\0${relativePath}`)
    .digest("hex")
    .slice(0, 32);
  return `workspace-artifact:${digest}`;
}
