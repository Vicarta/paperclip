const PLUGIN_KEY = "paperclip-file-browser-example";
const FILES_TAB_SLOT_ID = "files-tab";

const BOARD_SCOPED_ROUTE_ROOTS = new Set([
  "activity",
  "agents",
  "approvals",
  "companies",
  "costs",
  "dashboard",
  "goals",
  "inbox",
  "issues",
  "my-issues",
  "plugins",
  "projects",
  "settings",
]);

function normalizeExplicitPrefix(prefix: string | null | undefined): string {
  const trimmed = prefix?.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function resolveCompanyRoutePrefix(
  explicitPrefix: string | null | undefined,
  pathname: string | null | undefined,
): string {
  const normalized = normalizeExplicitPrefix(explicitPrefix);
  if (normalized) return normalized;
  if (!pathname) return "";

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return "";
  return BOARD_SCOPED_ROUTE_ROOTS.has(segments[1] ?? "") ? `/${segments[0]}` : "";
}

export function buildProjectFilesHref(
  projectRef: string | null | undefined,
  options?: {
    companyPrefix?: string | null;
    currentPathname?: string | null;
    filePath?: string | null;
  },
): string {
  if (!projectRef) return "#";

  const prefix = resolveCompanyRoutePrefix(options?.companyPrefix, options?.currentPathname);
  const params = new URLSearchParams({
    tab: `plugin:${PLUGIN_KEY}:${FILES_TAB_SLOT_ID}`,
  });
  if (options?.filePath) {
    params.set("file", options.filePath);
  }

  return `${prefix}/projects/${projectRef}?${params.toString()}`;
}

