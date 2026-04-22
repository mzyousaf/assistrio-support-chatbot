import { cn } from '@/lib/utils';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
  /**
   * When true, shows `offLabel` / `onLabel` inside a wider track (segmented style).
   * Default switch is unchanged when omitted or false.
   */
  showLabels?: boolean;
  /** Visible when `showLabels` (default: Off) */
  offLabel?: string;
  /** Visible when `showLabels` (default: On) */
  onLabel?: string;
};

/** Compact track (~36×20px) with sliding thumb; use for feature toggles in forms. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  className,
  showLabels,
  offLabel = 'Off',
  onLabel = 'On',
}: SwitchProps) {
  if (showLabels) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        id={id}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          'relative grid h-5 w-[3.25rem] shrink-0 grid-cols-2 items-center overflow-hidden rounded-full p-[2px]',
          'transition-[background-color] duration-200 ease-out',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-[var(--color-teal-600)]' : 'bg-slate-200',
          className,
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-[2px] z-0 h-[calc(100%-4px)] w-[calc(50%-3px)] rounded-full bg-white shadow-sm ring-1 ring-slate-900/[0.05]',
            'transition-all duration-200 ease-out',
            checked ? 'right-[2px] left-auto' : 'left-[2px] right-auto',
          )}
          aria-hidden
        />
        <span
          className={cn(
            'relative z-[1] flex min-w-0 items-center justify-center text-[0.5rem] font-bold uppercase leading-none tracking-wide',
            !checked ? 'text-slate-800' : 'text-white/85',
          )}
        >
          {offLabel}
        </span>
        <span
          className={cn(
            'relative z-[1] flex min-w-0 items-center justify-center text-[0.5rem] font-bold uppercase leading-none tracking-wide',
            checked ? 'text-slate-800' : 'text-slate-500',
          )}
        >
          {onLabel}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent p-0',
        'transition-[background-color] duration-200 ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[var(--color-teal-600)]' : 'bg-slate-200',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute left-[3px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-sm ring-1 ring-slate-900/[0.08]',
          'transition-transform duration-200 ease-out',
          /* w-9 (36px) − 3px inset − 12px thumb − 3px inset = 18px travel */
          checked ? 'translate-x-[18px]' : 'translate-x-0',
        )}
        aria-hidden
      />
    </button>
  );
}
