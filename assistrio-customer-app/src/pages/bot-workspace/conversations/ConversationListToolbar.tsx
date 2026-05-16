import { cn } from '@/lib/utils';
import { Filter, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  /** When omitted, only filter/refresh controls render (e.g. page supplies its own `<h1>`). */
  title?: string;
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
};

export function ConversationListToolbar({
  title,
  activeFilterCount,
  filterOpen,
  onFilterClick,
  onRefreshClick,
  refreshDisabled,
  refreshLoading,
  filterAriaLabel = 'Open conversation filters',
  refreshAriaLabel = 'Refresh chat logs',
  trailingExtra,
}: Props) {
  return (
    <div className="flex h-[var(--insights-chat-logs-header-height)] shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 px-3 py-2.5 sm:px-3.5 sm:py-3">
      <div className="min-w-0 flex-1">
        {title != null && title !== '' ? (
          <h2 className="m-0 min-w-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h2>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {trailingExtra}
        <div className="relative">
          <button
            type="button"
            onClick={onFilterClick}
            aria-expanded={filterOpen}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white text-teal-600 shadow-sm transition',
              activeFilterCount > 0
                ? 'border-teal-300/90 ring-1 ring-teal-500/20'
                : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/90',
              'hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50',
            )}
            title="Filters"
            aria-label={filterAriaLabel}
          >
            <Filter size={15} className="text-teal-600" strokeWidth={2} />
          </button>
          {activeFilterCount > 0 ? (
            <span className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
              {activeFilterCount > 9 ? '9+' : activeFilterCount}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRefreshClick}
          disabled={refreshDisabled}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-teal-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50 disabled:pointer-events-none disabled:opacity-45"
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
  );
}
