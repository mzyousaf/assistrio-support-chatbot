/**
 * Deterministic, JSON-stable fingerprint for preview-only embed overrides so React memos reliably
 * re-run when semantics change — including when nested plain objects differ only by key insertion order.
 *
 * Preview init HTTP calls intentionally omit overrides (baseline from `/preview/init`; display merged
 * client-side in {@link resolveWidgetDisplayModel}). This key is **not** part of runtime embed identity.
 */

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function omitUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const n = omitUndefinedDeep(item);
      if (n !== undefined) out.push(n);
    }
    return out;
  }
  if (value instanceof Date) return value.toISOString();
  if (!isPlainRecord(value)) return undefined;
  const sortedKeys = Object.keys(value).sort();
  const obj: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    const n = omitUndefinedDeep(value[k]);
    if (n !== undefined) obj[k] = n;
  }
  return obj;
}

/** Returns `""` when there are no JSON-serializable preview overrides (including non-objects). */
export function createStablePreviewOverridesKey(overrides: unknown): string {
  if (overrides === undefined || overrides === null) return "";
  const normalized = omitUndefinedDeep(overrides);
  if (
    normalized === undefined ||
    typeof normalized !== "object" ||
    normalized === null ||
    Array.isArray(normalized)
  ) {
    return "";
  }
  const keys = Object.keys(normalized as Record<string, unknown>);
  if (keys.length === 0) return "";
  try {
    return JSON.stringify(normalized);
  } catch {
    return "";
  }
}
