export type ProductMapping = {
  productId: string | null;
  productFamily: string | null;
  productName: string | null;
  confidence: "known" | "inferred" | "ambiguous" | "unknown";
  reason: string;
};

export type PageClassification = {
  pageType: string;
  language: string;
  countryTarget: string | null;
};

const PRODUCT_RULES: Array<{
  pattern: RegExp;
  productId: string;
  productFamily: string;
  productName: string;
  reason: string;
}> = [
  { pattern: /raid/i, productId: "raid-recovery", productFamily: "RAID Recovery", productName: "RAID Recovery", reason: "RAID URL or filename" },
  { pattern: /vmfs|vmdk|esxi|vmware/i, productId: "vmfs-recovery", productFamily: "VMFS Recovery", productName: "VMFS Recovery", reason: "VMFS/VMware URL or filename" },
  { pattern: /linux-reader|linux_reader/i, productId: "linux-reader", productFamily: "Linux filesystem utility", productName: "Linux Reader", reason: "Linux Reader URL or filename" },
  { pattern: /linux-writer|linux_writer/i, productId: "linux-writer", productFamily: "Linux filesystem utility", productName: "Linux Writer", reason: "Linux Writer URL or filename" },
  { pattern: /linux-recovery/i, productId: "linux-recovery", productFamily: "Linux Recovery", productName: "Linux Recovery", reason: "Linux Recovery URL or filename" },
  { pattern: /ntfs/i, productId: "ntfs-recovery", productFamily: "NTFS Recovery", productName: "NTFS Recovery", reason: "NTFS URL or filename" },
  { pattern: /partition/i, productId: "partition-recovery", productFamily: "Partition Recovery", productName: "Partition Recovery", reason: "Partition URL or filename" },
  { pattern: /(?:office|word|excel|powerpoint|outlook|mail)/i, productId: "office-mail-recovery", productFamily: "Office/Mail Recovery", productName: "Office/Mail Recovery", reason: "Office/Mail URL or filename" },
  { pattern: /(?:sql|mysql|oracle|database|dbx)/i, productId: "database-recovery", productFamily: "Database Recovery", productName: "Database Recovery", reason: "Database URL or filename" },
];

const LANGUAGE_PREFIXES: Record<string, { language: string; countryTarget: string | null }> = {
  de: { language: "de", countryTarget: "DE" },
  fr: { language: "fr", countryTarget: "FR" },
  es: { language: "es", countryTarget: "MX" },
  it: { language: "it", countryTarget: "IT" },
  ru: { language: "ru", countryTarget: null },
  ja: { language: "ja", countryTarget: "JP" },
  zh: { language: "zh", countryTarget: "CN" },
};

export function classifyDiskInternalsPage(url: string): PageClassification {
  const parsed = new URL(url, "https://www.diskinternals.com");
  const segments = parsed.pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase() ?? "";
  const locale = LANGUAGE_PREFIXES[first] ?? { language: "en", countryTarget: "US" };
  const path = parsed.pathname.toLowerCase();
  let pageType = "other";
  if (/thank[-_]?you|download-complete|thanks/.test(path)) pageType = "thank_you";
  else if (/checkout|cart|order|purchase|buy/.test(path)) pageType = "order";
  else if (/download/.test(path)) pageType = "download";
  else if (/blog|article|how-to|tutorial|guide|manual/.test(path)) pageType = "article";
  else if (/recovery|reader|writer|repair|undelete/.test(path)) pageType = "product";
  else if (segments.length <= 1) pageType = "hub";
  return { pageType, language: locale.language, countryTarget: locale.countryTarget };
}

export function mapDiskInternalsProduct(input: {
  url?: string | null;
  downloadFilename?: string | null;
  title?: string | null;
}): ProductMapping {
  const haystack = [input.url, input.downloadFilename, input.title]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const matches = PRODUCT_RULES.filter((rule) => rule.pattern.test(haystack));
  if (matches.length === 0) {
    return {
      productId: null,
      productFamily: null,
      productName: null,
      confidence: "unknown",
      reason: "No DiskInternals product rule matched",
    };
  }
  const uniqueProductIds = new Set(matches.map((match) => match.productId));
  if (uniqueProductIds.size > 1) {
    return {
      productId: null,
      productFamily: null,
      productName: null,
      confidence: "ambiguous",
      reason: `Multiple product rules matched: ${[...uniqueProductIds].join(", ")}`,
    };
  }
  const [match] = matches;
  return {
    productId: match!.productId,
    productFamily: match!.productFamily,
    productName: match!.productName,
    confidence: "inferred",
    reason: match!.reason,
  };
}
