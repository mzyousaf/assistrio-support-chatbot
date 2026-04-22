/**
 * Lead field `key` derivation from display label: lowercase, non-alphanumeric → `-`,
 * collapse repeats, trim edges; empty label → `field`. Uniqueness via numeric suffix.
 */

export function baseKeyFromLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return base || 'field';
}

/**
 * Returns a key unique among `takenKeys`, excluding `excludeKey` (e.g. current field when editing).
 */
export function uniqueLeadFieldKey(
  label: string,
  takenKeys: readonly string[],
  excludeKey?: string | null,
): string {
  const n = baseKeyFromLabel(label);
  const used = new Set(takenKeys.filter((k) => k && k !== excludeKey));
  if (!used.has(n)) return n;
  let i = 2;
  while (used.has(`${n}-${i}`)) i++;
  return `${n}-${i}`;
}
