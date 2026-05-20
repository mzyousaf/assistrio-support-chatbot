import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FilterCapsuleProps = {
  /** Shown when no value is applied (e.g. “Training Status”). Hidden once a value is selected. */
  title: string;
  /** Shown after the title and `|` when the selection is visible. */
  valueLabel: string;
  /**
   * Legacy: when true, chip uses selected styling, shows title|value, and (by default) X clears.
   * Prefer passing `selectionVisible` / `clearable` when they should differ (e.g. show value + Plus only).
   */
  applied: boolean;
  /** When set, controls selected chip styling and title|value row. Defaults to `applied`. */
  selectionVisible?: boolean;
  /**
   * When true, leading control is X and clears. When false, leading control is Plus and opens the menu.
   * Defaults to `applied` (legacy: X only when applied).
   */
  clearable?: boolean;
  /**
   * Dashed “add filter” chip but still show `title | valueLabel` in neutral slate (Plus on the left).
   * Use for initial default values before the user commits the filter.
   */
  quietValueRow?: boolean;
  /**
   * When true beside a visible external label, omit duplicated `title` and `|` in the chip —
   * only {@link valueLabel} is shown inside the pill.
   */
  chipTitleHidden?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Called when the leading X is used (only when `clearable` is true). */
  onClear: () => void;
  children: ReactNode;
};

const PANEL_MIN_WIDTH_PX = 15 * 16; /* 15rem — matches prior min-w-[15rem] */
const PANEL_Z = 1100; /* align with Select portal menus */

/**
 * Pill-shaped filter control: Plus opens menu; optional X clears when `clearable`.
 * Dropdown panel when open. Selected styling when `selectionVisible` (defaults to `applied`).
 *
 * The list is portaled to `document.body` with `position: fixed` so it is not clipped by
 * workspace `overflow` (e.g. editor column beside the widget preview).
 */
export function FilterCapsule({
  title,
  valueLabel,
  applied,
  selectionVisible: selectionVisibleProp,
  clearable: clearableProp,
  quietValueRow = false,
  chipTitleHidden = false,
  open,
  onToggle,
  onClose,
  onClear,
  children,
}: FilterCapsuleProps) {
  const chipHighlighted = selectionVisibleProp ?? applied;
  const showValueRow = chipHighlighted || quietValueRow;
  const showClearButton = clearableProp !== undefined ? clearableProp : applied;

  const valueOnlyClasses = cn(
    'min-w-0 truncate',
    chipTitleHidden ? 'font-normal' : 'font-semibold',
    chipHighlighted
      ? 'text-[var(--color-teal-700)] group-hover:text-[var(--color-teal-800)]'
      : 'text-slate-700 group-hover:text-slate-800',
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  const reposition = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !open) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const panelW = Math.max(PANEL_MIN_WIDTH_PX, r.width);
    let left = r.left;
    if (vw > 0) {
      left = Math.min(left, Math.max(margin, vw - panelW - margin));
    }
    setPanelStyle({
      position: 'fixed',
      top: r.bottom + gap,
      left,
      minWidth: panelW,
      zIndex: PANEL_Z,
    });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    reposition();
    const ro = new ResizeObserver(() => reposition());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-ui-select-menu]')) return;
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

  const panel =
    open && panelStyle ? (
      <div
        ref={panelRef}
        className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.05]"
        style={panelStyle}
        role="listbox"
      >
        {children}
      </div>
    ) : null;

  return (
    <div className="relative inline-flex h-[30px] max-w-full min-w-0 shrink-0" ref={wrapRef}>
      <div
        className={cn(
          'group inline-flex h-full max-w-full min-w-0 items-center overflow-hidden rounded-full border text-xs transition-colors duration-150',
          chipHighlighted
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
            !showClearButton && 'rounded-l-full hover:bg-slate-100/80',
            showClearButton && 'rounded-l-full hover:bg-[var(--color-teal-100)]/35',
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (showClearButton) onClear();
            else onToggle();
          }}
          aria-label={showClearButton ? 'Clear filter' : 'Open filter menu'}
        >
          <span
            className={cn(
              'flex h-[14px] w-[14px] items-center justify-center rounded-full border bg-white transition-colors duration-150',
              showClearButton
                ? 'border-[var(--color-teal-600)]/45 text-[var(--color-teal-700)] group-hover:border-[var(--color-teal-600)]/60 group-hover:bg-white'
                : 'border-slate-300 text-slate-500 group-hover:border-[var(--color-teal-600)]/40 group-hover:text-[var(--color-teal-600)]',
            )}
          >
            {showClearButton ? (
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
            !chipHighlighted && 'hover:text-slate-900',
          )}
          onClick={onToggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={chipTitleHidden && showValueRow ? `${title}, ${valueLabel}` : undefined}
        >
          {showValueRow ? (
            chipTitleHidden ? (
              <span className={valueOnlyClasses}>{valueLabel}</span>
            ) : (
              <>
                <span className="shrink-0 font-normal text-slate-700 group-hover:text-slate-800">{title}</span>
                <span className="shrink-0 text-slate-300" aria-hidden>
                  |
                </span>
                <span
                  className={cn(
                    'min-w-0 truncate font-semibold',
                    chipHighlighted
                      ? 'text-[var(--color-teal-700)] group-hover:text-[var(--color-teal-800)]'
                      : 'text-slate-700 group-hover:text-slate-800',
                  )}
                >
                  {valueLabel}
                </span>
              </>
            )
          ) : (
            <span className="shrink-0 font-normal text-slate-700">{title}</span>
          )}
        </button>
      </div>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
