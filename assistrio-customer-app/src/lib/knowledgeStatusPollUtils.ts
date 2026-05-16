import type { CustomerKnowledgeStatusItem } from '@/api/types';
import { KB_TRAINING_AFFECTED_ALL, type KbTrainingAffectedType } from '@/lib/botSyncEvents';
import { normalizeKnowledgeTrainingStatus } from '@/lib/knowledgeTrainingStatus';

/** Sections whose poll rows carry a stable list slot index (`faqIndex`, `snippetIndex`, …). */
export type KbIndexedPollSection = Exclude<KbTrainingAffectedType, 'document'>;

/**
 * Whether a status poll row may be merged / matched for a given KB subsection.
 * When `sourceType` is set, it must match — indices alone must not attach a row to the wrong section.
 * When `sourceType` is missing (legacy), allow slot indices only for that subsection.
 */
export function pollRowEligibleForKbMerge(
  it: CustomerKnowledgeStatusItem,
  want: KbIndexedPollSection,
): boolean {
  const st = typeof it.sourceType === 'string' ? it.sourceType.trim().toLowerCase() : '';
  if (st === want) return true;
  if (st !== '') return false;
  switch (want) {
    case 'faq':
      return typeof it.faqIndex === 'number' && Number.isFinite(it.faqIndex);
    case 'note':
      return typeof it.snippetIndex === 'number' && Number.isFinite(it.snippetIndex);
    case 'table':
      return typeof it.tableIndex === 'number' && Number.isFinite(it.tableIndex);
    case 'suggestion':
      return typeof it.suggestionIndex === 'number' && Number.isFinite(it.suggestionIndex);
    default:
      return false;
  }
}

/**
 * When duplicate poll rows target the same slot, prefer the row that reflects **in-flight import/extraction**
 * over a stale `ready` snapshot so list badges do not flicker (especially datasheets during CSV import).
 */
export function knowledgeStatusPollRowPipelineRank(it: CustomerKnowledgeStatusItem): number {
  const ds = String(it.displayStatus ?? '')
    .trim()
    .toLowerCase();
  const ex = String(it.extractionStatus ?? '')
    .trim()
    .toLowerCase();
  const st = normalizeKnowledgeTrainingStatus(it.status);

  if (it.isImporting === true) return 1000;
  if (ds === 'import_queued' || ds === 'importing' || ds === 'importing_table') return 1000;
  if (ds === 'import_failed') return 950;

  if (ex === 'queued' || ex === 'processing' || ex === 'waiting_for_source') return 900;
  if (it.isExtracting === true) return 890;
  if (ex === 'failed' || ds === 'extraction_failed') return 860;

  if (st === 'processing' || it.isTraining === true) return 800;
  if (st === 'queued') return 750;
  if (st === 'pending') return 700;
  if (st === 'failed' || st === 'out_of_storage') return 650;
  if (st === 'ready') return 100;
  return 50;
}

/** Prefer the furthest lifecycle when multiple GET `/knowledge/status` rows share the same FAQ slot (e.g. chunk rows). */
export function pickBetterKnowledgeStatusItem(
  a: CustomerKnowledgeStatusItem,
  b: CustomerKnowledgeStatusItem,
): CustomerKnowledgeStatusItem {
  const pa = knowledgeStatusPollRowPipelineRank(a);
  const pb = knowledgeStatusPollRowPipelineRank(b);
  if (pa !== pb) return pa > pb ? a : b;

  const rank = (raw: unknown): number => {
    const s = normalizeKnowledgeTrainingStatus(
      raw as string | number | boolean | null | undefined,
    );
    switch (s) {
      case 'ready':
        return 100;
      case 'processing':
        return 80;
      case 'queued':
        return 70;
      case 'pending':
        return 50;
      case 'failed':
        return 40;
      case 'out_of_storage':
        return 30;
      default:
        return 0;
    }
  };
  const pSta = rank(a.status);
  const pStb = rank(b.status);
  if (pSta !== pStb) return pSta > pStb ? a : b;

  const ts = (iso: string | null | undefined): number => {
    if (typeof iso !== 'string' || !iso.trim()) return NaN;
    const t = Date.parse(iso.trim());
    return Number.isFinite(t) ? t : NaN;
  };
  const ta = ts(a.lastTrainedAt);
  const tb = ts(b.lastTrainedAt);
  if (Number.isFinite(ta) || Number.isFinite(tb)) {
    if (!Number.isFinite(ta)) return b;
    if (!Number.isFinite(tb)) return a;
    return tb >= ta ? b : a;
  }
  const ua = ts(a.updatedAt);
  const ub = ts(b.updatedAt);
  if (Number.isFinite(ua) || Number.isFinite(ub)) {
    if (!Number.isFinite(ua)) return b;
    if (!Number.isFinite(ub)) return a;
    return ub >= ua ? b : a;
  }
  return b;
}

/**
 * Resolve the poll row for a FAQ list/detail slot. Matches stable id first, then all rows with `faqIndex === listIndex`,
 * collapsing duplicates with {@link pickBetterKnowledgeStatusItem}.
 */
export function resolveFaqPollRow(
  slice: CustomerKnowledgeStatusItem[],
  listIndex: number,
  knowledgeItemId?: string | null,
): CustomerKnowledgeStatusItem | null {
  const scoped = slice.filter((it) => pollRowEligibleForKbMerge(it, 'faq'));
  if (!scoped.length || !Number.isFinite(listIndex) || listIndex < 0) return null;
  const kid = knowledgeItemId?.trim();
  if (kid) {
    const exact = scoped.find((it) => String(it.id ?? '').trim() === kid);
    if (exact) return exact;
  }
  const bucket = scoped.filter(
    (it) => typeof it.faqIndex === 'number' && Number.isFinite(it.faqIndex) && it.faqIndex === listIndex,
  );
  if (bucket.length === 0) return null;
  return bucket.reduce((best, cur) => pickBetterKnowledgeStatusItem(best, cur));
}

/** Snippets (`note`): resolve poll row by stable id, then by `snippetIndex === listIndex`, collapsing duplicates. */
export function resolveSnippetPollRow(
  slice: CustomerKnowledgeStatusItem[],
  listIndex: number,
  knowledgeItemId?: string | null,
): CustomerKnowledgeStatusItem | null {
  const scoped = slice.filter((it) => pollRowEligibleForKbMerge(it, 'note'));
  if (!scoped.length || !Number.isFinite(listIndex) || listIndex < 0) return null;
  const kid = knowledgeItemId?.trim();
  if (kid) {
    const exact = scoped.find((it) => String(it.id ?? '').trim() === kid);
    if (exact) return exact;
  }
  const bucket = scoped.filter(
    (it) =>
      typeof it.snippetIndex === 'number' &&
      Number.isFinite(it.snippetIndex) &&
      it.snippetIndex === listIndex,
  );
  if (bucket.length === 0) return null;
  return bucket.reduce((best, cur) => pickBetterKnowledgeStatusItem(best, cur));
}

/** Which KB section a lightweight status row belongs to (`sourceType`; legacy `documentId` for files). */
export function knowledgeStatusItemSection(it: CustomerKnowledgeStatusItem): KbTrainingAffectedType | null {
  const st = typeof it.sourceType === 'string' ? it.sourceType.trim().toLowerCase() : '';
  if (st === 'document' || String(it.documentId ?? '').trim()) return 'document';
  if (st === 'faq') return 'faq';
  if (st === 'note') return 'note';
  if (st === 'table') return 'table';
  if (st === 'suggestion') return 'suggestion';
  return null;
}

/** Latest merged row for a typed detail poll (`section` + stable KB `id`), if present in the coordinator cache. */
export function findCachedKnowledgeStatusItemForPoll(
  items: CustomerKnowledgeStatusItem[] | null | undefined,
  section: KbTrainingAffectedType,
  itemId: string,
): CustomerKnowledgeStatusItem | null {
  const id = itemId.trim();
  if (!id || !items?.length) return null;
  for (const it of items) {
    if (String(it.id ?? '').trim() !== id) continue;
    const sec = knowledgeStatusItemSection(it);
    if (sec != null && sec !== section) continue;
    return it;
  }
  return null;
}

/**
 * Whether `GET …/knowledge/status?type=&itemId=` should keep polling while the agent section bucket is idle.
 * Covers in-flight training / extract / import, plus manual-retry hints and upload/extract/import headline rows.
 */
export function itemKnowledgePollNeedsItemScopedRefresh(
  item: CustomerKnowledgeStatusItem,
  section: KbTrainingAffectedType,
): boolean {
  if (item.isTraining === true) return true;
  if (section === 'document' && item.isExtracting === true) return true;
  if (section === 'table' && item.isImporting === true) return true;

  const canon = normalizeKnowledgeTrainingStatus(item.status);
  if (canon === 'queued' || canon === 'processing') return true;

  if (section === 'document') {
    const ex = String(item.extractionStatus ?? '').trim().toLowerCase();
    if (ex === 'failed') {
      return item.extractManualRetrySuggested === true;
    }
    if (ex && ex !== 'not_required' && ex !== 'done') {
      return true;
    }
  }

  if (item.trainingManualRetrySuggested === true) return true;
  if (item.extractManualRetrySuggested === true) return true;

  const ds = String(item.displayStatus ?? '').trim().toLowerCase();
  if (
    ds === 'uploading' ||
    ds === 'extracting' ||
    ds === 'extracting_text' ||
    ds === 'importing' ||
    ds === 'import_queued' ||
    ds === 'importing_table'
  ) {
    return true;
  }

  return false;
}

export function filterKnowledgeStatusItemsBySection(
  items: CustomerKnowledgeStatusItem[] | null | undefined,
  section: KbTrainingAffectedType,
): CustomerKnowledgeStatusItem[] {
  if (!items?.length) return [];
  return items.filter((it) => knowledgeStatusItemSection(it) === section);
}

/** Replace all items belonging to `section` with `incoming`, keep other sections from `prev`. */
export function mergeKnowledgeStatusItemsReplacingSection(
  prev: CustomerKnowledgeStatusItem[] | null | undefined,
  section: KbTrainingAffectedType,
  incoming: CustomerKnowledgeStatusItem[],
): CustomerKnowledgeStatusItem[] {
  const base = prev ?? [];
  const kept = base.filter((it) => knowledgeStatusItemSection(it) !== section);
  return [...kept, ...incoming];
}

export function mergeKnowledgeStatusItemsReplacingManySections(
  prev: CustomerKnowledgeStatusItem[] | null | undefined,
  updates: Array<{ section: KbTrainingAffectedType; items: CustomerKnowledgeStatusItem[] }>,
): CustomerKnowledgeStatusItem[] {
  let acc = [...(prev ?? [])];
  for (const { section, items } of updates) {
    acc = mergeKnowledgeStatusItemsReplacingSection(acc, section, items);
  }
  return acc;
}

/** Merge a partial `GET …/status?type=&itemId=` response (typically 0–1 rows). */
export function mergeKnowledgeStatusItemsPatchSectionRows(
  prev: CustomerKnowledgeStatusItem[] | null | undefined,
  section: KbTrainingAffectedType,
  incoming: CustomerKnowledgeStatusItem[],
): CustomerKnowledgeStatusItem[] {
  if (incoming.length === 0) return [...(prev ?? [])];
  const normalized = incoming.map((it) =>
    knowledgeStatusItemSection(it) == null && typeof it.id === 'string' && it.id.trim()
      ? { ...it, sourceType: section }
      : it,
  );
  const replaceIds = new Set(normalized.map((x) => x.id));
  const kept = (prev ?? []).filter((it) => {
    if (knowledgeStatusItemSection(it) !== section) return true;
    return !replaceIds.has(it.id);
  });
  return [...kept, ...normalized];
}

/** Which `GET …/knowledge/status?type=` values to fetch for the current Knowledge Base route (parallel merges). */
export function knowledgeStatusTypesForWorkspacePath(pathname: string): KbTrainingAffectedType[] {
  if (!pathname.includes('/playground/knowledgebase')) {
    return [];
  }
  if (pathname.includes('/documents')) return ['document'];
  if (pathname.includes('/faqs')) return ['faq'];
  if (pathname.includes('/snippets')) return ['note'];
  if (pathname.includes('/datasheets')) return ['table'];
  if (pathname.includes('/suggestions')) return ['suggestion'];
  return [...KB_TRAINING_AFFECTED_ALL];
}

const SECTION_ORDER = new Map<KbTrainingAffectedType, number>(
  KB_TRAINING_AFFECTED_ALL.map((s, i) => [s, i]),
);

/** Dedupe + stable order matching {@link KB_TRAINING_AFFECTED_ALL}. */
export function sortKnowledgeStatusSectionsStable(sections: KbTrainingAffectedType[]): KbTrainingAffectedType[] {
  return [...new Set(sections)].sort((a, b) => (SECTION_ORDER.get(a) ?? 99) - (SECTION_ORDER.get(b) ?? 99));
}

/**
 * Resolves which typed `/knowledge/status` polls should run after `ASSISTRIO_WORKSPACE_BOT_REFRESH`.
 * Prefer explicit `affectedSections`, else sections with active poll registrations, else URL fallback.
 */
export function knowledgeSectionsForWorkspaceBotRefresh(args: {
  affectedSections?: KbTrainingAffectedType[] | undefined;
  /** Distinct sections from mounted `registerKnowledgeStatusPollInterest` registrations. */
  registeredSectionKeys: KbTrainingAffectedType[];
  pathname: string;
}): KbTrainingAffectedType[] {
  if (args.affectedSections != null && args.affectedSections.length > 0) {
    return sortKnowledgeStatusSectionsStable(args.affectedSections);
  }
  if (args.registeredSectionKeys.length > 0) {
    return sortKnowledgeStatusSectionsStable(args.registeredSectionKeys);
  }
  return sortKnowledgeStatusSectionsStable(knowledgeStatusTypesForWorkspacePath(args.pathname));
}
