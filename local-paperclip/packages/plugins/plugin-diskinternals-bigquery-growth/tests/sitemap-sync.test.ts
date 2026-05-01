import { describe, expect, it } from "vitest";
import { parseSitemapIndexXml, parseSitemapXml, summarizeSitemapEntries } from "../src/sitemap-sync.js";

describe("sitemap sync helpers", () => {
  it("parses sitemap URLs into normalized inventory rows", () => {
    const entries = parseSitemapXml(`
      <urlset>
        <url>
          <loc>https://diskinternals.com/vmfs-recovery/</loc>
          <lastmod>2026-04-01T00:00:00+00:00</lastmod>
        </url>
      </urlset>
    `);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.normalizedUrl).toBe("https://www.diskinternals.com/vmfs-recovery");
    expect(summarizeSitemapEntries(entries)).toMatchObject({
      row_count: 1,
      unique_url_count: 1,
    });
  });

  it("parses sitemap index entries", () => {
    const entries = parseSitemapIndexXml(`
      <sitemapindex>
        <sitemap>
          <loc>https://www.diskinternals.com/post-sitemap.xml</loc>
          <lastmod>2026-05-01</lastmod>
        </sitemap>
      </sitemapindex>
    `);

    expect(entries).toEqual([{
      loc: "https://www.diskinternals.com/post-sitemap.xml",
      lastmod: "2026-05-01",
    }]);
  });
});
