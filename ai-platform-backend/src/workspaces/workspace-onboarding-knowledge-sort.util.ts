export type OnboardingKbSortable = {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sequence?: number | null;
  updateSequence?: number | null;
};

function parseSortMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function sortNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Latest first: updateSequence → updatedAt → sequence → createdAt → id. */
export function sortOnboardingKbItemsLatestFirst<T extends OnboardingKbSortable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const updateSeqDiff = sortNumber(b.updateSequence) - sortNumber(a.updateSequence);
    if (updateSeqDiff !== 0) return updateSeqDiff;

    const updatedDiff = parseSortMs(b.updatedAt) - parseSortMs(a.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;

    const seqDiff = sortNumber(b.sequence) - sortNumber(a.sequence);
    if (seqDiff !== 0) return seqDiff;

    const createdDiff = parseSortMs(b.createdAt) - parseSortMs(a.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return b.id.localeCompare(a.id);
  });
}
