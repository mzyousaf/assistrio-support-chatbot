/**
 * KB / MB / GB display: at most one decimal place; trim “.0” for whole values
 * (e.g. `2.3 KB`, `3 KB` — never `3.0 KB`).
 */
function fmtScaledKnowledgeSize(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const s = rounded.toFixed(1);
  return s.endsWith('.0') ? String(Math.round(rounded)) : s;
}

/** Display size treating `n` as a byte estimate (characters are used as proxy in knowledge UI). */
export function formatKnowledgeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${fmtScaledKnowledgeSize(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${fmtScaledKnowledgeSize(mb)} MB`;
  const gb = mb / 1024;
  return `${fmtScaledKnowledgeSize(gb)} GB`;
}
