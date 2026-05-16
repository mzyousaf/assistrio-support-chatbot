/**
 * Normalize `noteMeta.snippetIndex` from Mongo lean docs for customer APIs (`GET …/knowledge/status`, indexed snippet training).
 */
export function coerceNoteSnippetIndex(noteMeta: unknown): number | undefined {
  if (noteMeta === null || noteMeta === undefined) return undefined;
  if (typeof noteMeta !== 'object') return undefined;
  const m = noteMeta as { kind?: unknown; snippetIndex?: unknown };
  const kind =
    typeof m.kind === 'string' ? m.kind.trim().toLowerCase() : '';
  if (kind === 'general_note') return undefined;

  const raw = m.snippetIndex;
  let idx: number | undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    idx = Math.trunc(raw);
  } else if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
    idx = Number(raw.trim());
  } else if (raw != null && typeof raw === 'object') {
    const conv = raw as { toNumber?: () => number };
    if (typeof conv.toNumber === 'function') {
      try {
        const v = conv.toNumber();
        if (typeof v === 'number' && Number.isFinite(v)) idx = Math.trunc(v);
      } catch {
        /* ignore */
      }
    }
  }
  if (idx === undefined || idx < 0 || !Number.isFinite(idx)) return undefined;

  if (kind === 'snippet') return idx;
  /** Legacy rows may omit `kind` but still carry `snippetIndex`. */
  if (kind === '') return idx;
  return undefined;
}
