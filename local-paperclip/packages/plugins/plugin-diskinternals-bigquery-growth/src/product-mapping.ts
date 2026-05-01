export type ProductMapping = {
  productId: string | null;
  productFamily: string | null;
  confidence: "known" | "inferred" | "ambiguous" | "unknown";
  reason: string;
};

const PRODUCT_RULES: Array<{
  pattern: RegExp;
  productId: string;
  productFamily: string;
  reason: string;
}> = [
  { pattern: /raid/i, productId: "raid-recovery", productFamily: "RAID Recovery", reason: "RAID URL or filename" },
  { pattern: /vmfs|vmdk|esxi|vmware/i, productId: "vmfs-recovery", productFamily: "VMFS Recovery", reason: "VMFS/VMware URL or filename" },
  { pattern: /linux-reader|linux_reader/i, productId: "linux-reader", productFamily: "Linux filesystem utility", reason: "Linux Reader URL or filename" },
  { pattern: /linux-writer|linux_writer/i, productId: "linux-writer", productFamily: "Linux filesystem utility", reason: "Linux Writer URL or filename" },
  { pattern: /ntfs/i, productId: "ntfs-recovery", productFamily: "NTFS Recovery", reason: "NTFS URL or filename" },
  { pattern: /partition/i, productId: "partition-recovery", productFamily: "Partition Recovery", reason: "Partition URL or filename" },
];

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
      confidence: "unknown",
      reason: "No DiskInternals product rule matched",
    };
  }
  const uniqueProductIds = new Set(matches.map((match) => match.productId));
  if (uniqueProductIds.size > 1) {
    return {
      productId: null,
      productFamily: null,
      confidence: "ambiguous",
      reason: `Multiple product rules matched: ${[...uniqueProductIds].join(", ")}`,
    };
  }
  const [match] = matches;
  return {
    productId: match!.productId,
    productFamily: match!.productFamily,
    confidence: "inferred",
    reason: match!.reason,
  };
}
