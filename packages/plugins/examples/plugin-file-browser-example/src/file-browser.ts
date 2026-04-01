import * as fs from "node:fs";
import * as path from "node:path";
import type { FileEntry, FileSortBy, FileSortDir, FileSortMode } from "./file-browser-types.js";

const PATH_LIKE_PATTERN = /[\\/]/;
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPosixRelativePath(root: string, fullPath: string): string {
  return path.relative(root, fullPath).split(path.sep).join("/");
}

export function looksLikeWorkspacePath(value: string): boolean {
  const normalized = value.trim();
  return (PATH_LIKE_PATTERN.test(normalized) || WINDOWS_DRIVE_PATH_PATTERN.test(normalized))
    && !UUID_PATTERN.test(normalized);
}

export function sanitizeWorkspacePath(pathValue: string): string {
  return looksLikeWorkspacePath(pathValue) ? pathValue.trim() : "";
}

export function resolveWorkspace(workspacePath: string, requestedPath?: string): string | null {
  const root = path.resolve(workspacePath);
  const resolved = requestedPath ? path.resolve(root, requestedPath) : root;
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function compareModifiedAt(a: FileEntry, b: FileEntry): number {
  const left = Date.parse(a.modifiedAt);
  const right = Date.parse(b.modifiedAt);
  if (Number.isNaN(left) && Number.isNaN(right)) return 0;
  if (Number.isNaN(left)) return -1;
  if (Number.isNaN(right)) return 1;
  return left - right;
}

function getSearchRelevance(name: string, query: string): number {
  const normalizedName = name.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 2;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  return 3;
}

function compareNameSort(
  a: FileEntry,
  b: FileEntry,
  sortDir: FileSortDir,
  relevanceQuery?: string,
): number {
  if (relevanceQuery) {
    const leftRelevance = getSearchRelevance(a.name, relevanceQuery);
    const rightRelevance = getSearchRelevance(b.name, relevanceQuery);
    if (leftRelevance !== rightRelevance) {
      return leftRelevance - rightRelevance;
    }
  }
  const result = compareStrings(a.name, b.name) || compareStrings(a.path, b.path);
  return sortDir === "asc" ? result : -result;
}

function compareModifiedSort(a: FileEntry, b: FileEntry, sortDir: FileSortDir): number {
  const result = compareModifiedAt(a, b) || compareStrings(a.name, b.name) || compareStrings(a.path, b.path);
  return sortDir === "asc" ? result : -result;
}

export function sortFileEntries(
  entries: FileEntry[],
  sortBy: FileSortBy,
  sortDir: FileSortDir,
  mode: FileSortMode,
  relevanceQuery?: string,
): FileEntry[] {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    if (mode === "tree" && a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    if (sortBy === "name") {
      return compareNameSort(a, b, sortDir, mode === "search" ? relevanceQuery : undefined);
    }

    return compareModifiedSort(a, b, sortDir);
  });
  return sorted;
}

function toFileEntry(root: string, fullPath: string, stat: fs.Stats): FileEntry {
  return {
    name: path.basename(fullPath),
    path: toPosixRelativePath(root, fullPath),
    isDirectory: stat.isDirectory(),
    modifiedAt: stat.mtime.toISOString(),
  };
}

export function listWorkspaceDirectoryEntries(
  workspacePath: string,
  directoryPath?: string,
  sortBy: FileSortBy = "name",
  sortDir: FileSortDir = "asc",
): FileEntry[] {
  const root = path.resolve(workspacePath);
  const dirPath = resolveWorkspace(root, directoryPath);
  if (!dirPath) return [];
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return [];
    const dirents = fs.readdirSync(dirPath, { withFileTypes: true });
    const entries: FileEntry[] = [];
    for (const dirent of dirents) {
      const fullPath = path.join(dirPath, dirent.name);
      try {
        const childStat = fs.lstatSync(fullPath);
        if (!childStat.isFile() && !childStat.isDirectory()) continue;
        entries.push(toFileEntry(root, fullPath, childStat));
      } catch {
        continue;
      }
    }
    return sortFileEntries(entries, sortBy, sortDir, "tree");
  } catch {
    return [];
  }
}

function walkWorkspaceFiles(
  root: string,
  currentPath: string,
  onFile: (entry: FileEntry) => void,
): void {
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const dirent of dirents) {
    const fullPath = path.join(currentPath, dirent.name);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walkWorkspaceFiles(root, fullPath, onFile);
      continue;
    }

    if (!stat.isFile()) {
      continue;
    }

    onFile(toFileEntry(root, fullPath, stat));
  }
}

export function searchWorkspaceFilesByName(
  workspacePath: string,
  query: string,
  sortBy: FileSortBy = "name",
  sortDir: FileSortDir = "asc",
): FileEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const root = path.resolve(workspacePath);
  const entries: FileEntry[] = [];
  walkWorkspaceFiles(root, root, (entry) => {
    if (entry.name.toLowerCase().includes(normalizedQuery)) {
      entries.push(entry);
    }
  });
  return sortFileEntries(entries, sortBy, sortDir, "search", normalizedQuery);
}
