import { normalizeCustomerEmbedOrigin } from '@/lib/embedOrigin';

type OriginLike = { origin: string; isActive: boolean };

export function countActiveValidOrigins(rows: OriginLike[]): number {
  return rows.filter((r) => r.isActive && normalizeCustomerEmbedOrigin(r.origin.trim())).length;
}

export function wouldLoseAllActiveOriginsAfterRemove(rows: OriginLike[], removeIndex: number): boolean {
  return countActiveValidOrigins(rows.filter((_, i) => i !== removeIndex)) === 0;
}

export function wouldLoseAllActiveOriginsAfterUpdate(
  rows: OriginLike[],
  index: number,
  patch: Partial<Pick<OriginLike, 'origin' | 'isActive'>>,
): boolean {
  const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
  return countActiveValidOrigins(next) === 0;
}
