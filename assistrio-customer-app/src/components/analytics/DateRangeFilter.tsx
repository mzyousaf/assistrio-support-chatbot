import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type DateRange, type Matcher } from '@daypicker/react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  computeDateRangePopoverPosition,
  customRangeIsValid,
  dateRangeFromYmd,
  dateToYmd,
  formatCustomRangeTriggerLabel,
  seedDefaultCustomRange,
  startOfTodayLocal,
  ymdFromDateRange,
  ymdToLocalDate,
} from './dateRangeFilterUtils';
import './dateRangeFilter.css';

export type DateRangeFilterValue<P extends string = string> = {
  preset: P;
  from?: string;
  to?: string;
};

export type DateRangePresetOption<P extends string = string> = {
  id: P;
  label: string;
  disabled?: boolean;
};

const POPOVER_Z = 1200;
const POPOVER_WIDTH_PX = 280;
const POPOVER_ESTIMATED_HEIGHT_PX = 380;
const VIEWPORT_MARGIN_PX = 24;
const MOBILE_MAX_WIDTH_PX = 639;

function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}

function isNodeInsideRef(node: Node | null, ref: RefObject<HTMLElement | null>): boolean {
  if (!node || !ref.current) return false;
  return ref.current.contains(node);
}

type CustomRangeTriggerButtonProps = {
  triggerRef?: RefObject<HTMLButtonElement | null>;
  label: string;
  active: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
  testId?: string;
  showCheck?: boolean;
  selected?: boolean;
  className?: string;
};

function CustomRangeTriggerButton({
  triggerRef,
  label,
  active,
  disabled,
  compact,
  onClick,
  testId = 'date-range-preset-custom',
  showCheck = true,
  selected = false,
  className,
}: CustomRangeTriggerButtonProps) {
  return (
    <button
      ref={triggerRef}
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`Custom date range, ${label}`}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        'date-range-custom-trigger flex w-full items-center gap-2 rounded-md px-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        compact ? 'py-1 text-xs' : 'py-1.5 text-sm',
        active
          ? 'date-range-custom-trigger--active border border-[color-mix(in_oklab,var(--color-teal-600)_22%,rgb(226_232_240))] bg-[color-mix(in_oklab,var(--color-teal-50,rgb(240_253_250))_88%,white)] text-[var(--color-teal-900,rgb(19_78_74))]'
          : 'border border-transparent text-slate-800 hover:bg-slate-50',
        className,
      )}
      onClick={onClick}
    >
      {showCheck ? (
        <span className="flex w-4 shrink-0 justify-center" aria-hidden>
          {selected ? <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} /> : null}
        </span>
      ) : null}
      <CalendarDays
        className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-[var(--color-teal-600)]' : 'text-slate-400')}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
    </button>
  );
}

type CustomDateRangePopoverProps = {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  align: 'left' | 'right';
  draftRange: DateRange | undefined;
  onDraftRangeChange: (next: DateRange | undefined) => void;
  onApply: () => void;
  onCancel: () => void;
  minFromYmd?: string | null;
  disableFutureDates?: boolean;
  disabled?: boolean;
};

function CustomDateRangePopover({
  open,
  triggerRef,
  align,
  draftRange,
  onDraftRangeChange,
  onApply,
  onCancel,
  minFromYmd,
  disableFutureDates = true,
  disabled,
}: CustomDateRangePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const partialStartRef = useRef<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [placement, setPlacement] = useState<'below' | 'above'>('below');
  const [hoverDate, setHoverDate] = useState<Date | undefined>();
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    if (!open) {
      partialStartRef.current = null;
      setHoverDate(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = popoverRef.current;
    if (!node) return;
    node.focus({ preventScroll: true });
  }, [open, panelStyle]);

  const handleRangeSelect = (next: DateRange | undefined) => {
    setHoverDate(undefined);

    if (!next?.from) {
      partialStartRef.current = null;
      onDraftRangeChange(undefined);
      return;
    }

    const fromYmd = dateToYmd(next.from);
    const toYmd = next.to ? dateToYmd(next.to) : '';

    if (!next.to || fromYmd === toYmd) {
      if (partialStartRef.current === fromYmd) {
        onDraftRangeChange({ from: next.from, to: next.from });
        partialStartRef.current = null;
        return;
      }
      partialStartRef.current = fromYmd;
      onDraftRangeChange({ from: next.from, to: undefined });
      return;
    }

    partialStartRef.current = null;
    onDraftRangeChange(next);
  };

  const handleUseOneDayRange = () => {
    if (!draftRange?.from) return;
    partialStartRef.current = null;
    onDraftRangeChange({ from: draftRange.from, to: draftRange.from });
  };

  const disabledMatchers = useMemo((): Matcher[] => {
    const matchers: Matcher[] = [];
    const minFrom = minFromYmd?.trim();
    if (minFrom) {
      const minDate = ymdToLocalDate(minFrom);
      if (minDate) matchers.push({ before: minDate });
    }
    if (disableFutureDates) {
      matchers.push({ after: startOfTodayLocal() });
    }
    return matchers;
  }, [disableFutureDates, minFromYmd]);

  const canApply = customRangeIsValid(draftRange);
  const showOneDayAction = Boolean(draftRange?.from && !draftRange?.to);

  const hoverPreviewModifiers = useMemo((): Record<string, Matcher> | undefined => {
    if (!draftRange?.from || draftRange.to || !hoverDate) return undefined;

    const start = draftRange.from.getTime() <= hoverDate.getTime() ? draftRange.from : hoverDate;
    const end = draftRange.from.getTime() <= hoverDate.getTime() ? hoverDate : draftRange.from;
    const startYmd = dateToYmd(start);
    const endYmd = dateToYmd(end);

    return {
      preview_range_start: (date) => dateToYmd(date) === startYmd,
      preview_range_end: (date) => dateToYmd(date) === endYmd,
      preview_range_middle: (date) => {
        const ymd = dateToYmd(date);
        return ymd > startYmd && ymd < endYmd;
      },
    };
  }, [draftRange, hoverDate]);

  const handleDayMouseEnter = (day: Date, modifiers: { disabled?: boolean }) => {
    if (modifiers.disabled) return;
    if (draftRange?.from && !draftRange?.to) {
      setHoverDate(day);
    }
  };

  const reposition = useCallback(() => {
    if (isMobile) {
      setPlacement('below');
      setPanelStyle({
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 0,
        zIndex: POPOVER_Z,
      });
      return;
    }

    const anchor = triggerRef.current;
    if (!anchor || !open) return;
    const triggerRect = anchor.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? POPOVER_ESTIMATED_HEIGHT_PX;
    const popoverWidth =
      popoverRef.current?.offsetWidth ??
      Math.min(POPOVER_WIDTH_PX, window.innerWidth - VIEWPORT_MARGIN_PX);
    const position = computeDateRangePopoverPosition(
      triggerRect,
      { width: popoverWidth, height: popoverHeight },
      { width: window.innerWidth, height: window.innerHeight },
      { align, margin: VIEWPORT_MARGIN_PX / 2, gap: 8 },
    );

    setPlacement(position.placement);
    setPanelStyle({
      position: 'fixed',
      top: position.top,
      left: position.left,
      maxWidth: `calc(100vw - ${VIEWPORT_MARGIN_PX}px)`,
      zIndex: POPOVER_Z,
    });
  }, [align, triggerRef, isMobile, open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target as Node;
      if (isNodeInsideRef(target, popoverRef)) return;
      if (isNodeInsideRef(target, triggerRef)) return;
      onCancel();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    document.addEventListener('pointerdown', onPointerDownCapture, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel, open, triggerRef]);

  const stopInnerPointer = (event: React.PointerEvent | React.MouseEvent) => {
    event.stopPropagation();
  };

  const panel =
    open && panelStyle ? (
      <div
        ref={popoverRef}
        data-assistrio-date-range-popover
        data-testid="custom-date-range-popover"
        data-popover-placement={placement}
        role="dialog"
        aria-label="Custom range"
        tabIndex={-1}
        className={cn(
          'date-range-popover assistrio-date-range-popover rounded-2xl border border-slate-200/90 bg-white shadow-[0_16px_48px_-16px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/[0.04]',
          isMobile && 'assistrio-date-range-popover--mobile rounded-t-2xl',
        )}
        style={panelStyle}
        onPointerDown={stopInnerPointer}
        onMouseDown={stopInnerPointer}
      >
        <header className="date-range-popover__header">
          <h3 className="date-range-popover__title">Custom range</h3>
          <p className="date-range-popover__subtitle">Select the dates you want to analyze.</p>
        </header>

        <div
          className="date-range-popover__calendar"
          data-testid="custom-range-calendar"
          onMouseLeave={() => setHoverDate(undefined)}
        >
          <DayPicker
            mode="range"
            selected={draftRange}
            onSelect={handleRangeSelect}
            onDayMouseEnter={handleDayMouseEnter}
            modifiers={hoverPreviewModifiers}
            modifiersClassNames={{
              preview_range_start: 'rdp-range_start',
              preview_range_middle: 'rdp-range_middle',
              preview_range_end: 'rdp-range_end',
            }}
            numberOfMonths={1}
            disabled={disabled ? true : disabledMatchers}
            showOutsideDays={false}
            labels={{
              labelPrevious: () => 'Previous month',
              labelNext: () => 'Next month',
            }}
          />
        </div>

        {showOneDayAction ? (
          <button
            type="button"
            className="date-range-popover__one-day-action"
            data-testid="custom-range-one-day-action"
            disabled={disabled}
            onClick={handleUseOneDayRange}
          >
            Use as one-day range
          </button>
        ) : null}

        <footer className="date-range-popover__footer" data-testid="custom-range-footer">
          <div className="date-range-popover__footer-actions">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={onApply} disabled={!canApply || disabled}>
              Apply
            </Button>
          </div>
        </footer>
      </div>
    ) : null;

  return typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null;
}

export type DateRangeFilterProps<P extends string = string> = {
  value: DateRangeFilterValue<P>;
  onChange: (next: DateRangeFilterValue<P>) => void;
  presets: DateRangePresetOption<P>[];
  customPresetId?: P;
  disabled?: boolean;
  align?: 'left' | 'right';
  compact?: boolean;
  minFromYmd?: string | null;
  disableFutureDates?: boolean;
  footer?: ReactNode;
  onAfterPresetSelect?: () => void;
  onAfterCustomApply?: () => void;
  className?: string;
};

export function DateRangeFilter<P extends string = string>({
  value,
  onChange,
  presets,
  customPresetId = 'custom' as P,
  disabled,
  align = 'right',
  compact = false,
  minFromYmd,
  disableFutureDates = true,
  footer,
  onAfterPresetSelect,
  onAfterCustomApply,
  className,
}: DateRangeFilterProps<P>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() =>
    dateRangeFromYmd(value.from, value.to),
  );

  const customActive = value.preset === customPresetId;
  const customTriggerLabel =
    customActive && value.from?.trim() && value.to?.trim()
      ? formatCustomRangeTriggerLabel(value.from, value.to)
      : 'Custom range';

  const openCustomPopover = useCallback(() => {
    const seeded =
      value.from?.trim() || value.to?.trim()
        ? dateRangeFromYmd(value.from, value.to)
        : undefined;
    setDraftRange(seeded);
    setCustomPopoverOpen(true);
  }, [value.from, value.to]);

  const closeCustomPopover = useCallback(() => {
    setCustomPopoverOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleCustomCancel = () => {
    closeCustomPopover();
  };

  const handlePresetClick = (opt: DateRangePresetOption<P>) => {
    if (opt.disabled || disabled) return;
    if (opt.id === customPresetId) {
      openCustomPopover();
      return;
    }
    onChange({ preset: opt.id, from: '', to: '' });
    onAfterPresetSelect?.();
  };

  const handleCustomApply = () => {
    if (!customRangeIsValid(draftRange)) return;
    const { from, to } = ymdFromDateRange(draftRange);
    onChange({ preset: customPresetId, from, to });
    closeCustomPopover();
    onAfterCustomApply?.();
  };

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="date-range-filter">
      <ul
        className="m-0 list-none space-y-0.5 p-0 py-0.5"
        role="listbox"
        aria-label="Date range presets"
      >
        {presets.map((opt) => {
          const selected = value.preset === opt.id;
          const isCustom = opt.id === customPresetId;
          if (isCustom) {
            return (
              <li key={opt.id}>
                <CustomRangeTriggerButton
                  triggerRef={triggerRef}
                  label={customTriggerLabel}
                  active={customActive}
                  selected={selected}
                  disabled={disabled || opt.disabled}
                  compact={compact}
                  onClick={() => handlePresetClick(opt)}
                />
              </li>
            );
          }
          return (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled || opt.disabled}
                data-testid={`date-range-preset-${opt.id}`}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 text-left text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
                  compact ? 'py-1 text-xs' : 'py-1.5 text-sm',
                )}
                onClick={() => handlePresetClick(opt)}
              >
                <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                  {selected ? <Check className="h-3.5 w-3.5 text-[var(--color-teal-600)]" strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0 flex-1">{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {footer}

      <CustomDateRangePopover
        open={customPopoverOpen}
        triggerRef={triggerRef}
        align={align}
        draftRange={draftRange}
        onDraftRangeChange={setDraftRange}
        onApply={handleCustomApply}
        onCancel={handleCustomCancel}
        minFromYmd={minFromYmd}
        disableFutureDates={disableFutureDates}
        disabled={disabled}
      />
    </div>
  );
}

export function toDateRangeFilterValue<P extends string>(input: {
  preset: P;
  customFrom?: string;
  customTo?: string;
}): DateRangeFilterValue<P> {
  return {
    preset: input.preset,
    from: input.customFrom,
    to: input.customTo,
  };
}

export function fromDateRangeFilterValue<P extends string>(
  value: DateRangeFilterValue<P>,
): { preset: P; customFrom: string; customTo: string } {
  return {
    preset: value.preset,
    customFrom: value.from ?? '',
    customTo: value.to ?? '',
  };
}

export { seedDefaultCustomRange };

type DateRangeCustomPickerTriggerProps = {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  disabled?: boolean;
  minFromYmd?: string | null;
  align?: 'left' | 'right';
  className?: string;
};

export function DateRangeCustomPickerTrigger({
  from,
  to,
  onApply,
  disabled,
  minFromYmd,
  align = 'right',
  className,
}: DateRangeCustomPickerTriggerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => dateRangeFromYmd(from, to));

  const openPopover = () => {
    const seeded = from.trim() || to.trim() ? dateRangeFromYmd(from, to) : undefined;
    setDraftRange(seeded);
    setOpen(true);
  };

  const closePopover = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const label =
    from.trim() && to.trim() && customRangeIsValid(dateRangeFromYmd(from, to))
      ? formatCustomRangeTriggerLabel(from, to)
      : 'Choose dates…';

  return (
    <>
      <CustomRangeTriggerButton
        triggerRef={triggerRef}
        label={label}
        active={Boolean(from.trim() && to.trim())}
        disabled={disabled}
        showCheck={false}
        testId="date-range-custom-trigger"
        className={className}
        onClick={openPopover}
      />
      <CustomDateRangePopover
        open={open}
        triggerRef={triggerRef}
        align={align}
        draftRange={draftRange}
        onDraftRangeChange={setDraftRange}
        onApply={() => {
          if (!customRangeIsValid(draftRange)) return;
          const next = ymdFromDateRange(draftRange);
          onApply(next.from, next.to);
          closePopover();
        }}
        onCancel={closePopover}
        minFromYmd={minFromYmd}
        disabled={disabled}
      />
    </>
  );
}
