import { createHash } from "node:crypto";

const TRACKING_PARAMETER_PREFIXES = ["utm_"];
const TRACKING_PARAMETER_NAMES = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "yclid",
  "_ga",
  "_gl",
  "mc_cid",
  "mc_eid",
  "sessionid",
  "sid",
]);

export type NormalizedUrl = {
  rawUrl: string;
  normalizedUrl: string;
  urlId: string;
  host: string;
  path: string;
  queryParametersKept: string[];
  queryParametersRemoved: string[];
};

function shouldRemoveParameter(name: string) {
  const lower = name.toLowerCase();
  return TRACKING_PARAMETER_NAMES.has(lower)
    || TRACKING_PARAMETER_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function normalizeDiskInternalsUrl(rawUrl: string): NormalizedUrl {
  const url = new URL(rawUrl, "https://www.diskinternals.com");
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname === "diskinternals.com") {
    url.hostname = "www.diskinternals.com";
  }
  url.hash = "";

  const kept = new URLSearchParams();
  const removed: string[] = [];
  const keptNames: string[] = [];
  for (const [name, value] of url.searchParams.entries()) {
    if (shouldRemoveParameter(name)) {
      removed.push(name);
      continue;
    }
    kept.append(name, value);
    keptNames.push(name);
  }
  kept.sort();
  url.search = kept.toString();

  if (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/index.html/")) {
    url.pathname = url.pathname.replace(/\/index\.html\/?$/i, "/");
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  const normalizedUrl = url.toString();
  const urlId = createHash("sha256").update(normalizedUrl).digest("hex").slice(0, 24);

  return {
    rawUrl,
    normalizedUrl,
    urlId,
    host: url.hostname,
    path: url.pathname,
    queryParametersKept: keptNames.sort(),
    queryParametersRemoved: removed.sort(),
  };
}
