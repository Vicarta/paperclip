function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeAdapterConfigs(
  base: Record<string, unknown>,
  overlay: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!overlay) return { ...base };
  const next: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) {
      delete next[key];
      continue;
    }
    const current = next[key];
    if (isPlainRecord(current) && isPlainRecord(value)) {
      next[key] = mergeAdapterConfigs(current, value);
      continue;
    }
    next[key] = value;
  }

  return next;
}
