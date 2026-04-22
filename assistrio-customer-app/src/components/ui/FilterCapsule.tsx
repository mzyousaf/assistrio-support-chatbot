import { useEffect, useRef, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FilterCapsuleProps = {
  /** Shown when no value is applied (e.g. “Training Status”). Hidden once a value is selected. */
  title: string;
  /** When `applied`, shown after the title and `|` — the selected option label. */
  valueLabel: string;
  applied: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** When `applied`, the leading control becomes a clear (X) action. */
  onClear: () => void;
  children: ReactNode;
};

/**
 * Pill-shaped filter control: Plus + filter title when unset; when applied, X + title | value.
 * Dropdown panel when open. Applied state uses teal surface; selected value is teal.
 */
export function FilterCapsule({
  title,
  valueLabel,
  applied,
  open,
  onToggle,
  onClose,
  onClear,
  children,
}: FilterCapsuleProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div className="relative inline-flex h-[30px] max-w-full min-w-0 shrink-0" ref={wrapRef}>
      <div
        className={cn(
          'group inline-flex h-full max-w-full min-w-0 items-center overflow-hidden rounded-full border text-xs transition-colors duration-150',
          applied
            ? 'border-[var(--color-teal-600)]/35 bg-[var(--teal-50)] pl-1 pr-2 hover:border-[var(--color-teal-600)]/50 hover:bg-[var(--active-soft)]'
            : 'border-dashed border-slate-300 bg-white pl-1 pr-2 hover:border-slate-400 hover:bg-slate-50',
        )}
      >
        <button
          type="button"
          className={cn(
            'flex h-full shrink-0 items-center rounded-l-full py-0 pl-0.5 pr-1',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal-600)]/35',
            !applied && 'rounded-l-full hover:bg-slate-100/80',
            applied && 'rounded-l-full hover:bg-[var(--color-teal-100)]/35',
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (applied) onClear();
            else onToggle();
          }}
          aria-label={applied ? 'Remove filter' : 'Open filter menu'}
        >
          <span
            className={cn(
              'flex h-[14px] w-[14px] items-center justify-center rounded-full border bg-white transition-colors duration-150',
              applied
                ? 'border-[var(--color-teal-600)]/45 text-[var(--color-teal-700)] group-hover:border-[var(--color-teal-600)]/60 group-hover:bg-white'
                : 'border-slate-300 text-slate-500 group-hover:border-[var(--color-teal-600)]/40 group-hover:text-[var(--color-teal-600)]',
            )}
          >
            {applied ? (
              <X className="h-2 w-2" strokeWidth={2} aria-hidden />
            ) : (
              <Plus className="h-2 w-2" strokeWidth={2} aria-hidden />
            )}
          </span>
        </button>
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1 border-0 bg-transparent py-0 text-left transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal-600)]/35',
            'rounded-r-full pr-0.5',
            !applied && 'hover:text-slate-900',
          )}
          onClick={onToggle}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {applied ? (
            <>
              <span className="shrink-0 font-normal text-slate-700 group-hover:text-slate-800">{title}</span>
              <span className="shrink-0 text-slate-300" aria-hidden>
                |
              </span>
              <span className="min-w-0 truncate font-semibold text-[var(--color-teal-700)] group-hover:text-[var(--color-teal-800)]">
                {valueLabel}
              </span>
            </>
          ) : (
            <span className="shrink-0 font-normal text-slate-700">{title}</span>
          )}
        </button>
      </div>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[70] min-w-[15rem] rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.05]"
          role="listbox"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
