import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useId,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './Input';

export type SearchableMultiSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional group heading rendered above the first option in each group. */
  group?: string;
};

export type SearchableMultiSelectProps = {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  options: SearchableMultiSelectOption[];
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  searchPlaceholder?: string;
  /** Trigger label when nothing is selected. */
  emptyLabel?: string;
  triggerClassName?: string;
};

const triggerBase = cn(
  'inline-flex w-full max-w-full min-h-9 h-9 items-center justify-between gap-2 rounded-[var(--ui-radius)] border bg-[var(--ui-surface)]',
  'px-3 text-left text-sm font-normal leading-tight text-slate-900 antialiased',
  'shadow-none transition-[border-color,box-shadow,background-color] duration-150 ease-out',
  'cursor-pointer',
  'focus:outline-none focus-visible:border-[var(--ui-border-focus)] focus-visible:ring-1 focus-visible:ring-slate-900/[0.06]',
  'disabled:cursor-not-allowed disabled:bg-[var(--ui-surface-muted)] disabled:text-slate-400',
);

const panelBase = cn(
  'flex max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200/95 bg-white',
  'shadow-[0_12px_40px_-12px_rgba(15,23,42,0.14),0_4px_14px_-4px_rgba(15,23,42,0.08)]',
  'ring-1 ring-slate-900/[0.05]',
);

type MenuRect = { top: number; left: number; width: number; maxHeight: number };

function computeMenuRect(el: HTMLElement): MenuRect {
  const r = el.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const spaceBelow = vh - r.bottom - gap - margin;
  const spaceAbove = r.top - gap - margin;
  const maxList = 20 * 16;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(maxList, Math.max(160, openUp ? spaceAbove : spaceBelow));
  if (openUp) {
    return {
      top: Math.max(margin, r.top - gap - maxHeight),
      left: r.left,
      width: r.width,
      maxHeight,
    };
  }
  return {
    top: r.bottom + gap,
    left: r.left,
    width: r.width,
    maxHeight,
  };
}

export function formatSearchableMultiSelectTriggerLabel(
  selectedValues: string[],
  options: SearchableMultiSelectOption[],
  emptyLabel = 'Any',
): string {
  if (selectedValues.length === 0) return emptyLabel;
  const labels = selectedValues.map((v) => options.find((o) => o.value === v)?.label ?? v);
  if (labels.length === 1) return labels[0]!;
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

/**
 * Multi-select dropdown with in-panel search (same trigger / portal pattern as {@link SearchableSelect}).
 */
export function SearchableMultiSelect({
  id,
  value,
  onChange,
  options,
  disabled,
  invalid,
  className,
  searchPlaceholder = 'Search…',
  emptyLabel = 'Any',
  triggerClassName,
}: SearchableMultiSelectProps) {
  const selected = useMemo(() => new Set(value.map(String)), [value]);
  const displayLabel = formatSearchableMultiSelectTriggerLabel(value, options, emptyLabel);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchId = useId();

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.group?.toLowerCase().includes(q) ?? false),
    );
  }, [options, searchQuery]);

  const groupedFiltered = useMemo(() => {
    const rows: Array<{ kind: 'group'; label: string } | { kind: 'option'; option: SearchableMultiSelectOption }> =
      [];
    let lastGroup: string | undefined;
    for (const o of filtered) {
      const g = o.group?.trim();
      if (g && g !== lastGroup) {
        rows.push({ kind: 'group', label: g });
        lastGroup = g;
      } else if (!g) {
        lastGroup = undefined;
      }
      rows.push({ kind: 'option', option: o });
    }
    return rows;
  }, [filtered]);

  const updateMenuRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setMenuRect(computeMenuRect(el));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
  }, [open, updateMenuRect]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updateMenuRect();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updateMenuRect]);

  useEffect(() => {
    if (!open) return;
    const t = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    if (!open) setSearchQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggleValue = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange([...next]);
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) setOpen((o) => !o);
    }
    if (e.key === 'ArrowDown' && !open && !disabled) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const panelContent =
    open && menuRect ? (
      <div
        ref={panelRef}
        className={panelBase}
        style={{
          position: 'fixed',
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          maxHeight: menuRect.maxHeight,
          zIndex: 1100,
        }}
      >
        <div className="shrink-0 border-b border-slate-100 px-2 py-2">
          <Input
            ref={searchInputRef}
            id={searchId}
            type="search"
            aria-label="Filter options"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
              }
            }}
            placeholder={searchPlaceholder}
            inputSize="sm"
            quiet
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            leadingIcon={<Search className="text-slate-400" size={14} strokeWidth={2} aria-hidden />}
            aria-controls={listId}
            className="font-normal"
            wrapperClassName="w-full"
          />
        </div>
        <ul id={listId} className="min-h-0 flex-1 list-none overflow-y-auto py-1" role="listbox" aria-multiselectable>
          {groupedFiltered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-slate-500">No matches. Try another search.</li>
          ) : (
            groupedFiltered.map((row, idx) => {
              if (row.kind === 'group') {
                return (
                  <li
                    key={`g-${row.label}-${idx}`}
                    className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 first:pt-1"
                    aria-hidden
                  >
                    {row.label}
                  </li>
                );
              }
              const o = row.option;
              const isSelected = selected.has(o.value);
              return (
                <li key={o.value} role="presentation" className="px-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={o.disabled}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm leading-snug text-slate-800',
                      'transition-colors duration-100',
                      'hover:bg-slate-50 focus:bg-slate-50 focus:outline-none',
                      isSelected &&
                        'bg-[var(--teal-50)] text-[var(--color-teal-800)] hover:bg-[color-mix(in_srgb,var(--teal-50)_92%,var(--color-teal-600)_8%)]',
                      o.disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                    )}
                    onClick={() => {
                      if (o.disabled) return;
                      toggleValue(o.value);
                    }}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
                        isSelected
                          ? 'border-[var(--color-teal-600)] bg-[var(--color-teal-600)]'
                          : 'border-slate-300 bg-white',
                      )}
                      aria-hidden
                    >
                      {isSelected ? (
                        <Check className="h-3 w-3 text-white" strokeWidth={2.75} />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">{o.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {value.length > 0 ? (
          <div className="shrink-0 border-t border-slate-100 px-2 py-1.5">
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => onChange([])}
            >
              Clear selection
            </button>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={cn('relative w-full min-w-0', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          triggerBase,
          invalid
            ? 'border-[var(--color-danger-border)] focus-visible:border-[var(--color-danger-text-emphasis)] focus-visible:ring-red-900/10'
            : 'border-[var(--ui-border)] hover:enabled:border-[var(--ui-border-hover)] hover:enabled:bg-white',
          triggerClassName,
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="min-w-0 flex-1 truncate text-left">{displayLabel}</span>
        <ChevronDown
          strokeWidth={2}
          className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {typeof document !== 'undefined' && panelContent ? createPortal(panelContent, document.body) : null}
    </div>
  );
}
