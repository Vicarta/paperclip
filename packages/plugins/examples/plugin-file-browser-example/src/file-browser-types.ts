export type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  modifiedAt: string;
};

export type FileSortBy = "name" | "modified";
export type FileSortDir = "asc" | "desc";
export type FileSortMode = "tree" | "search";

export const FILE_SORT_BY_OPTIONS = ["name", "modified"] as const satisfies readonly FileSortBy[];
export const FILE_SORT_DIR_OPTIONS = ["asc", "desc"] as const satisfies readonly FileSortDir[];
