import {
  Fragment,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useId,
  useCallback,
  Children,
  isValidElement,
  forwardRef,
  type ChangeEvent,
  type ReactNode,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  invalid?: boolean;
  /** Extra-neutral focus (reserved for parity with Input). */
  quiet?: boolean;
  /** Compact (28px), default modal (32px), or comfortable (36px). Default `lg` preserves legacy 36px triggers. */
  selectSize?: 'sm' | 'md' | 'lg';
  /** Applied to the trigger button (after base styles) e.g. compact `h-8`. */
  triggerClassName?: string;
  /** Applied to the portaled listbox menu. */
  menuClassName?: string;
};

type OptionRow = { value: string; label: string; disabled?: boolean; sectionLabel?: string };

function optionTextLabel(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  return '';
}

/** Flattens `<option>` / `<optgroup label>`/`option`/` children for the styled listbox. */
function parseOptions(children: ReactNode): OptionRow[] {
  const rows: OptionRow[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const typeStr = typeof child.type === 'string' ? child.type.toLowerCase() : '';
    if (typeStr === 'optgroup') {
      const gp = child.props as { label?: string; children?: ReactNode };
      const groupCaption = gp.label != null ? String(gp.label) : '';
      let firstOption = true;
      Children.forEach(gp.children ?? null, (optEl) => {
        if (!isValidElement(optEl)) return;
        const optType =
          typeof optEl.type === 'string' ? String(optEl.type).toLowerCase() : '';
        if (optType !== 'option') return;
        const p = optEl.props as { value?: string; disabled?: boolean; children?: ReactNode };
        const label = optionTextLabel(p.children);
        const v = String(p.value ?? '');
        rows.push({
          value: v,
          label: label || v,
          disabled: p.disabled,
          sectionLabel: firstOption && groupCaption ? groupCaption : undefined,
        });
        firstOption = false;
      });
      return;
    }
    if (typeStr === 'option') {
      const p = child.props as { value?: string; disabled?: boolean; children?: ReactNode };
      const label = optionTextLabel(p.children);
      const v = String(p.value ?? '');
      rows.push({
        value: v,
        label: label || v,
        disabled: p.disabled,
      });
    }
  });
  return rows;
}

const triggerBase = cn(
  'inline-flex w-full max-w-full items-center justify-between gap-2 rounded-[var(--ui-radius)] border bg-[var(--ui-surface)]',
  'text-left font-normal leading-tight text-slate-900 antialiased',
  'shadow-none transition-[border-color,box-shadow,background-color] duration-150 ease-out',
  'cursor-pointer',
  'focus:outline-none focus-visible:border-[var(--ui-border-focus)] focus-visible:ring-1 focus-visible:ring-slate-900/[0.06]',
  'disabled:cursor-not-allowed disabled:bg-[var(--ui-surface-muted)] disabled:text-slate-400',
);

type SelectSize = NonNullable<SelectProps['selectSize']>;

const triggerSizeClass: Record<SelectSize, string> = {
  sm: 'min-h-7 h-7 px-2.5 text-xs',
  md: 'min-h-8 h-8 px-3 text-[0.8125rem]',
  lg: 'min-h-9 h-9 px-3 text-sm',
};

const chevronSizeClass: Record<SelectSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

const optionButtonClass: Record<SelectSize, string> = {
  sm: 'flex h-7 min-h-7 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs leading-none text-slate-800',
  md: 'flex h-8 min-h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[0.8125rem] leading-none text-slate-800',
  lg: 'flex w-full cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm leading-snug text-slate-800',
};

const optionCheckWrapClass: Record<SelectSize, string> = {
  sm: 'flex h-3.5 w-3.5 shrink-0 items-center justify-center',
  md: 'flex h-3.5 w-3.5 shrink-0 items-center justify-center',
  lg: 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center',
};

const optionCheckIconClass: Record<SelectSize, string> = {
  sm: 'h-3 w-3 text-[var(--color-teal-700)]',
  md: 'h-3 w-3 text-[var(--color-teal-700)]',
  lg: 'h-3.5 w-3.5 text-[var(--color-teal-700)]',
};

const listboxVisual = cn(
  'overflow-y-auto overflow-x-hidden',
  'rounded-lg border border-slate-200/95 bg-white py-1',
  'shadow-[0_12px_40px_-12px_rgba(15,23,42,0.14),0_4px_14px_-4px_rgba(15,23,42,0.08)]',
  'ring-1 ring-slate-900/[0.05]',
);

type MenuRect = { left: number; width: number; maxHeight: number } & (
  | { top: number; bottom?: undefined }
  | { bottom: number; top?: undefined }
);

function computeMenuRect(el: HTMLElement): MenuRect {
  const r = el.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const spaceBelow = vh - r.bottom - gap - margin;
  const spaceAbove = r.top - gap - margin;
  const maxList = 16 * 16; /* 16rem */
  const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(maxList, Math.max(120, openUp ? spaceAbove : spaceBelow));
  if (openUp) {
    /** Anchor the menu's bottom edge just above the trigger; using `top` + assumed height was wrong when the list is shorter than `maxHeight` (large empty gap above the trigger). */
    return {
      bottom: vh - r.top + gap,
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

/**
 * Custom listbox select: styled trigger + rich dropdown (not the OS native menu).
 * List renders in a portal with fixed positioning so it is not clipped by overflow ancestors.
 * Accepts `<option>` and `<optgroup label="…">` / `<option>` children (flattened into one listbox with section captions).
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    className,
    invalid,
    quiet: _quiet = false,
    selectSize = 'lg',
    triggerClassName,
    menuClassName,
    disabled,
    children,
    value,
    defaultValue,
    onChange,
    id,
    name,
    required,
    'aria-label': ariaLabel,
  },
  ref,
) {
  const opts = parseOptions(children);
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = String(value ?? defaultValue ?? '');
  const selected = opts.find((o) => o.value === current);
  const displayLabel = selected?.label ?? (current ? current : opts[0]?.label ?? '—');

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
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const emitChange = (val: string) => {
    onChange?.({ target: { value: val } } as ChangeEvent<HTMLSelectElement>);
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

  const listContent =
    open && menuRect ? (
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        data-ui-select-menu
        className={cn(listboxVisual, menuClassName)}
        tabIndex={-1}
        style={{
          position: 'fixed',
          ...(menuRect.bottom != null ? { bottom: menuRect.bottom } : { top: menuRect.top }),
          left: menuRect.left,
          width: menuRect.width,
          maxHeight: menuRect.maxHeight,
          zIndex: 1100,
        }}
      >
        {opts.map((o, idx) => {
          const isSelected = o.value === current;
          return (
          <Fragment key={o.value}>
            {o.sectionLabel ? (
              <li
                role="presentation"
                className={cn(
                  'px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400',
                  idx > 0 ? 'border-t border-slate-100 pt-2' : 'pt-0.5 pb-1',
                )}
              >
                {o.sectionLabel}
              </li>
            ) : null}
            <li role="presentation" className="px-1">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={o.disabled}
                className={cn(
                  optionButtonClass[selectSize],
                  'transition-colors duration-100',
                  'hover:bg-slate-50 focus:bg-slate-50 focus:outline-none',
                  isSelected &&
                    'bg-[var(--teal-50)] text-[var(--color-teal-800)] hover:bg-[color-mix(in_srgb,var(--teal-50)_92%,var(--color-teal-600)_8%)]',
                  o.disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                )}
                onClick={() => {
                  if (o.disabled) return;
                  emitChange(o.value);
                  setOpen(false);
                }}
              >
                <span
                  className={cn(optionCheckWrapClass[selectSize], !isSelected && 'opacity-0')}
                  aria-hidden
                >
                  {isSelected ? (
                    <Check className={optionCheckIconClass[selectSize]} strokeWidth={2.5} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
              </button>
            </li>
          </Fragment>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={containerRef} className={cn('relative w-full min-w-0', className)}>
      {name ? <input type="hidden" name={name} value={current} readOnly /> : null}
      <button
        type="button"
        ref={ref}
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        className={cn(
          triggerBase,
          triggerSizeClass[selectSize],
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
          className={cn(
            chevronSizeClass[selectSize],
            'shrink-0 text-slate-400 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {typeof document !== 'undefined' && listContent ? createPortal(listContent, document.body) : null}
    </div>
  );
});
