import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Search } from 'lucide-react';
import type { CustomerChatsAnalyticsTopPageRow } from '@/api/types';
import { FilterCapsule, Input, Modal, Tooltip } from '@/components/ui';
import { formatAnalyticsChatsCountWithUnit, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import {
  CHATS_TOP_PAGES_UNKNOWN_LABEL,
  applyChatsTopPagesModalSort,
  chatsTopPageHref,
  chatsTopPageTooltipPath,
  filterChatsTopPagesByQuery,
  hasTopPagesSignal,
  isChatsTopPageUnknown,
  sortChatsTopPageRows,
  type ChatsTopPagesModalSortMode,
} from './chatsTopPages.util';

/** Rows shown in the card before "View all". */
export const CHATS_TOP_PAGES_COLLAPSED_LIMIT = 4;

type TopPagesModalCapsuleKey = 'sort' | null;

const TOP_PAGES_MODAL_SORT_OPTIONS: { id: ChatsTopPagesModalSortMode; label: string; capsule: string }[] = [
  { id: 'chats', label: 'Number of chats (most first)', capsule: 'Most chats' },
  { id: 'chats_asc', label: 'Number of chats (fewest first)', capsule: 'Fewest chats' },
  { id: 'messages', label: 'Number of messages (most first)', capsule: 'Most messages' },
  { id: 'messages_asc', label: 'Number of messages (fewest first)', capsule: 'Fewest messages' },
  { id: 'page', label: 'Page (A–Z)', capsule: 'Page A–Z' },
];

/** Tooltip copy when the visitor page URL was not recorded. */
const TOP_PAGES_UNKNOWN_TITLE_TOOLTIP = 'Page URL was not captured.';

type Props = {
  rows: CustomerChatsAnalyticsTopPageRow[];
};

function PageRow({
  row,
  maxConversations,
  rank,
}: {
  row: CustomerChatsAnalyticsTopPageRow;
  maxConversations: number;
  rank?: number;
}) {
  const unknown = isChatsTopPageUnknown(row);
  const w =
    maxConversations > 0 ? Math.min(100, Math.max(2, Math.round((row.conversations / maxConversations) * 100))) : 0;
  const display = unknown ? CHATS_TOP_PAGES_UNKNOWN_LABEL : chatsTopPageTooltipPath(row);
  const tooltip = chatsTopPageTooltipPath(row);
  const href = chatsTopPageHref(row);

  return (
    <div
      className={cn(
        'group flex min-w-0 flex-col gap-2 rounded-lg px-2.5 py-3 transition-colors sm:px-3',
        'hover:bg-slate-50/90',
        unknown && 'bg-slate-50/50 hover:bg-slate-50',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 gap-3">
          {rank != null ? (
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums',
                unknown ? 'bg-slate-200/80 text-slate-500' : 'bg-teal-100/90 text-teal-900',
              )}
              aria-hidden
            >
              {rank}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
              {unknown ? (
                <div className="min-w-0 flex-1">
                  <Tooltip content={TOP_PAGES_UNKNOWN_TITLE_TOOLTIP} fullWidth side="top">
                    <span
                      className={cn(
                        'min-w-0 truncate text-sm font-medium leading-snug',
                        'cursor-help text-slate-500',
                      )}
                    >
                      {display}
                    </span>
                  </Tooltip>
                </div>
              ) : href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm font-medium leading-snug text-slate-800',
                    'underline-offset-2 hover:text-teal-800 hover:underline',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-1',
                  )}
                  title={tooltip}
                >
                  {display}
                </a>
              ) : (
                <span
                  className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-slate-800"
                  title={tooltip}
                >
                  {display}
                </span>
              )}
              {unknown ? (
                <span className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Unknown
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                'mb-0 mt-1 text-xs tabular-nums leading-snug',
                unknown ? 'text-slate-400' : 'text-slate-600',
              )}
            >
              {formatAnalyticsChatsCountWithUnit(row.conversations)} · {formatAnalyticsInteger(row.messages)} messages
            </p>
          </div>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            unknown ? 'bg-slate-300/70' : 'bg-teal-600/70',
          )}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

function TopPagesList({
  rows,
  maxConversations,
  showRanks,
}: {
  rows: CustomerChatsAnalyticsTopPageRow[];
  maxConversations: number;
  showRanks?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      {rows.map((row, index) => (
        <PageRow
          key={`${row.page}-${row.pageLabel}-${index}`}
          row={row}
          rank={showRanks ? index + 1 : undefined}
          maxConversations={maxConversations}
        />
      ))}
    </div>
  );
}

export function ChatsTopPagesPanel({ rows }: Props) {
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSort, setModalSort] = useState<ChatsTopPagesModalSortMode>('chats');
  const [capsuleOpen, setCapsuleOpen] = useState<TopPagesModalCapsuleKey>(null);
  /** Pristine defaults: dashed capsule until user picks a non-default sort. */
  const [sortFilterEngaged, setSortFilterEngaged] = useState(false);
  const closeCapsules = useCallback(() => setCapsuleOpen(null), []);

  const sorted = useMemo(() => sortChatsTopPageRows(rows), [rows]);
  const maxConversations = Math.max(1, ...sorted.map((r) => r.conversations));
  const hasData = hasTopPagesSignal(rows);
  const listKey = useMemo(() => sorted.map((r) => `${r.page}:${r.conversations}`).join('\u0001'), [sorted]);
  const visible = sorted.slice(0, CHATS_TOP_PAGES_COLLAPSED_LIMIT);
  const hasMore = sorted.length > CHATS_TOP_PAGES_COLLAPSED_LIMIT;

  const modalListRows = useMemo(() => {
    const afterSearch = filterChatsTopPagesByQuery(sorted, modalSearch);
    return applyChatsTopPagesModalSort(afterSearch, modalSort);
  }, [sorted, modalSearch, modalSort]);
  const modalMaxConversations = Math.max(1, ...modalListRows.map((r) => r.conversations));

  const sortCapsuleLabel =
    TOP_PAGES_MODAL_SORT_OPTIONS.find((o) => o.id === modalSort)?.capsule ?? 'Most chats';

  useEffect(() => {
    if (viewAllOpen) {
      setModalSearch('');
      setModalSort('chats');
      setCapsuleOpen(null);
      setSortFilterEngaged(false);
    }
  }, [viewAllOpen]);

  if (!hasData) {
    return <p className="m-0 py-6 text-center text-sm text-slate-500">No page data yet.</p>;
  }

  const sortAtDefault = modalSort === 'chats';
  const sortQuiet = !sortFilterEngaged && sortAtDefault;
  const sortHighlighted = sortFilterEngaged || !sortAtDefault;

  return (
    <div key={listKey} className="flex min-h-0 flex-col">
      <TopPagesList rows={visible} maxConversations={maxConversations} showRanks />
      {hasMore ? (
        <div className="mt-3 flex w-full flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex w-fit max-w-full cursor-pointer select-none items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/50 px-2.5 py-1.5 text-left text-[11px] font-semibold text-teal-700 transition-colors hover:border-teal-200/80 hover:bg-teal-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 sm:text-xs"
            aria-label={`View all top pages — ${sorted.length} total`}
            onClick={() => setViewAllOpen(true)}
          >
            <span>View all</span>
            <ChevronRight className="h-3 w-3 shrink-0 text-teal-600 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      ) : null}

      <Modal
        open={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
        title="Top pages"
        description="All pages where visitors started or continued chats in this period."
        size="lg"
        className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[min(85vh,34rem)] sm:max-w-xl"
        closeOnBackdropClick
        bodyClassName="flex min-h-0 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5"
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
          <Input
            type="search"
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            placeholder="Search pages..."
            aria-label="Search top pages"
            inputSize="sm"
            quiet
            leadingIcon={<Search className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} aria-hidden />}
            className="min-w-0 flex-1 basis-0 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          <div className="shrink-0">
            <FilterCapsule
              title="Sort"
              valueLabel={sortCapsuleLabel}
              applied={false}
              quietValueRow={sortQuiet}
              selectionVisible={sortHighlighted}
              clearable={sortHighlighted}
              open={capsuleOpen === 'sort'}
              onToggle={() => setCapsuleOpen(capsuleOpen === 'sort' ? null : 'sort')}
              onClose={closeCapsules}
              onClear={() => {
                setModalSort('chats');
                setSortFilterEngaged(false);
                closeCapsules();
              }}
            >
              <ul className="m-0 max-h-52 min-w-[min(100vw-2rem,17rem)] list-none space-y-0.5 overflow-y-auto p-0 py-0.5">
                {TOP_PAGES_MODAL_SORT_OPTIONS.map((opt) => {
                  const selected = modalSort === opt.id;
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
                        onClick={() => {
                          setModalSort(opt.id);
                          setSortFilterEngaged(opt.id !== 'chats');
                          closeCapsules();
                        }}
                      >
                        <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                          {selected ? (
                            <Check className="h-3 w-3 text-[var(--color-teal-600)]" strokeWidth={2.5} />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">{opt.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </FilterCapsule>
          </div>
        </div>
        <div className="max-h-[min(55vh,22rem)] min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-gutter:stable]">
          {modalListRows.length === 0 ? (
            <p className="m-0 py-6 text-center text-sm text-slate-500">No pages match your search.</p>
          ) : (
            <TopPagesList rows={modalListRows} maxConversations={modalMaxConversations} showRanks />
          )}
        </div>
      </Modal>
    </div>
  );
}
