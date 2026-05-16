/**
 * UTF-8 byte measurement for KB limits (distinct from JavaScript string length / UTF-16 code units).
 */

export function getUtf8ByteCount(value: string | null | undefined): number {
  return Buffer.byteLength(value ?? '', 'utf8');
}

/** Serialized JSON size in UTF-8 bytes (0 when value serializes to undefined). */
export function getUtf8ByteCountForJson(value: unknown): number {
  const s = JSON.stringify(value);
  if (s === undefined) return 0;
  return Buffer.byteLength(s, 'utf8');
}
