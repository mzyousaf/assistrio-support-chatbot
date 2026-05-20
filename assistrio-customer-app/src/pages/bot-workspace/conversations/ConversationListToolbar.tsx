import { cn } from '@/lib/utils';
import { Filter, Loader2, RefreshCw, Settings, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ConversationFilterSummaryChip } from './conversationFiltersModel';

type Props = {
  /** When omitted, only filter/refresh controls render (e.g. page supplies its own `<h1>`). */
  title?: string;
  /** Applied filters shown under the title (Chat logs). */
  filterSummaryChips?: ConversationFilterSummaryChip[];
  /** Remove one applied dimension (chip id matches summary). */
  onRemoveFilterChip?: (chipId: string) => void;
  /** Clear every list filter at once. */
  onClearAllFilters?: () => void;
  activeFilterCount: number;
  filterOpen: boolean;
  onFilterClick: () => void;
  onRefreshClick: () => void;
  refreshDisabled: boolean;
  refreshLoading: boolean;
  /** Override for non–chat-log screens (e.g. Leads). */
  filterAriaLabel?: string;
  refreshAriaLabel?: string;
  /** Extra controls to the left of filter/refresh (e.g. Export). */
  trailingExtra?: ReactNode;
  /** Insights: open “which tags show on list rows” for this bot (gear). */
  onChatLogTagSettingsClick?: () => void;
  chatLogTagSettingsTitle?: string;
  chatLogTagSettingsAriaLabel?: string;
};

export function ConversationListToolbar({
  title,
  filterSummaryChips,
  onRemoveFilterChip,
  onClearAllFilters,
  activeFilterCount,
  filterOpen,
  onFilterClick,
  onRefreshClick,
  refreshDisabled,
  refreshLoading,
  filterAriaLabel = 'Open chat filters',
  refreshAriaLabel = 'Refresh chat logs',
  trailingExtra,
  onChatLogTagSettingsClick,
  chatLogTagSettingsTitle = 'Chat log tags',
  chatLogTagSettingsAriaLabel = 'Open chat log tag display settings',
}: Props) {
  const filterButtonTitle = activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Filters';
  const filterAria = activeFilterCount > 0 ? `${filterAriaLabel} (${activeFilterCount} active)` : filterAriaLabel;
  const showChipRow = filterSummaryChips != null && filterSummaryChips.length > 0;
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col border-b border-slate-200/60 px-3 py-2 sm:px-3.5 sm:py-2.5',
        showChipRow ? 'gap-1.5' : 'gap-0',
      )}
    >
      <div className="flex min-h-[2.375rem] min-w-0 items-center justify-between gap-2 sm:min-h-[2.5rem]">
        <div className="min-w-0 flex-1">
          {title != null && title !== '' ? (
            <h2 className="m-0 min-w-0 text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h2>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {trailingExtra}
          <div className="relative">
            <button
              type="button"
              onClick={onFilterClick}
              aria-expanded={filterOpen}
              className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white text-teal-600 shadow-sm transition',
                activeFilterCount > 0
                  ? 'border-teal-300/90 ring-1 ring-teal-500/20'
                  : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/90',
                'hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50',
              )}
              title={filterButtonTitle}
              aria-label={filterAria}
            >
              <Filter size={15} className="text-teal-600" strokeWidth={2} />
            </button>
            {activeFilterCount > 0 ? (
              <span className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                {activeFilterCount > 9 ? '9+' : activeFilterCount}
              </span>
            ) : null}
          </div>
          {onChatLogTagSettingsClick ? (
            <button
              type="button"
              onClick={onChatLogTagSettingsClick}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-teal-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50"
              title={chatLogTagSettingsTitle}
              aria-label={chatLogTagSettingsAriaLabel}
            >
              <Settings size={16} className="text-teal-600" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefreshClick}
            disabled={refreshDisabled}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-teal-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50 disabled:pointer-events-none disabled:opacity-45"
            title="Refresh"
            aria-label={refreshAriaLabel}
          >
            {refreshLoading ? (
              <Loader2 size={16} className="animate-spin text-teal-600" strokeWidth={2} />
            ) : (
              <RefreshCw size={15} className="text-teal-600" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {showChipRow && filterSummaryChips ? (
        <div
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2"
          aria-label="Active chat filters"
        >
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {filterSummaryChips.map((c) => (
              <span
                key={c.id}
                className="inline-flex max-w-full min-w-0 items-center rounded-md border border-teal-200/80 bg-teal-50/90 py-0.5 pl-2 text-[11px] font-medium leading-snug text-teal-900"
                title={c.label}
              >
                <span className="min-w-0 truncate">{c.label}</span>
                {onRemoveFilterChip ? (
                  <>
                    <span className="mx-1.5 shrink-0 select-none text-teal-700/45" aria-hidden>
                      |
                    </span>
                    <button
                      type="button"
                      className="mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-teal-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/40"
                      aria-label={`Remove filter: ${c.label}`}
                      onClick={() => onRemoveFilterChip(c.id)}
                    >
                      <X size={12} className="text-teal-800/85" strokeWidth={2.5} aria-hidden />
                    </button>
                  </>
                ) : null}
              </span>
            ))}
          </div>
          {onClearAllFilters ? (
            <button
              type="button"
              className="shrink-0 text-[11px] font-semibold text-teal-700 underline decoration-teal-600/35 underline-offset-2 hover:text-teal-900 hover:decoration-teal-700/60"
              onClick={onClearAllFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
