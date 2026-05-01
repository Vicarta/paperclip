import { normalizeDiskInternalsUrl } from "./url-normalization.js";

export type SitemapUrlEntry = {
  rawUrl: string;
  normalizedUrl: string;
  urlId: string;
  lastmod: string | null;
};

function extractTags(xml: string, tagName: string) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1]!.trim());
  }
  return values;
}

export function parseSitemapXml(xml: string): SitemapUrlEntry[] {
  const urlBlocks = extractTags(xml, "url");
  return urlBlocks.flatMap((block) => {
    const [loc] = extractTags(block, "loc");
    if (!loc) return [];
    const [lastmod] = extractTags(block, "lastmod");
    const normalized = normalizeDiskInternalsUrl(loc);
    return [{
      rawUrl: loc,
      normalizedUrl: normalized.normalizedUrl,
      urlId: normalized.urlId,
      lastmod: lastmod ?? null,
    }];
  });
}

export function summarizeSitemapEntries(entries: SitemapUrlEntry[]) {
  const unique = new Set(entries.map((entry) => entry.urlId));
  return {
    row_count: entries.length,
    unique_url_count: unique.size,
    sample: entries.slice(0, 10),
  };
}
