import { useEffect, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui';

type Props = {
  filtersSlot: ReactNode;
  searchInputId: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
};

export function LeadsToolbar({
  filtersSlot,
  searchInputId,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
}: Props) {
  return (
    <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{filtersSlot}</div>
        <div className="w-full min-w-0 shrink-0 lg:w-80 lg:max-w-md">
          <Input
            id={searchInputId}
            type="text"
            inputMode="search"
            quiet
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSearchSubmit();
              }
            }}
            placeholder="Search lead values…"
            leadingIcon={<Search size={16} strokeWidth={2} className="text-slate-400" aria-hidden />}
            clearable
            onClear={onSearchClear}
            autoComplete="off"
            aria-label="Search lead values in current view"
          />
        </div>
      </div>
    </div>
  );
}

/** Sync local search field when filters reset from outside (e.g. filter modal). */
export function useSyncedLeadsSearchInput(appliedSearch: string | undefined, filterKey: string): [string, (v: string) => void] {
  const [local, setLocal] = useState(appliedSearch ?? '');
  useEffect(() => {
    setLocal(appliedSearch ?? '');
  }, [filterKey, appliedSearch]);
  return [local, setLocal];
}
