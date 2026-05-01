import { createHash } from "node:crypto";

export type PageSnapshot = {
  httpStatus: number;
  finalUrl: string;
  canonicalDetected: string | null;
  noindexDetected: boolean;
  title: string | null;
  h1: string | null;
  contentHash: string;
  responseBytes: number;
};

function extractFirst(pattern: RegExp, html: string) {
  const match = pattern.exec(html);
  return match?.[1]?.replace(/\s+/g, " ").trim() || null;
}

export function parsePageSnapshot(input: {
  html: string;
  finalUrl: string;
  httpStatus: number;
}): PageSnapshot {
  const html = input.html.slice(0, 2_000_000);
  return {
    httpStatus: input.httpStatus,
    finalUrl: input.finalUrl,
    canonicalDetected: extractFirst(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i, html),
    noindexDetected: /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html),
    title: extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html),
    h1: extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html),
    contentHash: createHash("sha256").update(html).digest("hex"),
    responseBytes: Buffer.byteLength(input.html, "utf8"),
  };
}
