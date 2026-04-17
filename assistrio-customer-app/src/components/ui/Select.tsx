import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  /** Extra-neutral focus (same border emphasis as default; reserved for parity with Input). */
  quiet?: boolean;
};

const chevron =
  "bg-[length:0.875rem] bg-[right_0.625rem_center] bg-no-repeat pr-8 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]";

const base = cn(
  'w-full max-w-full appearance-none rounded-[var(--ui-radius)] border bg-[var(--ui-surface)] py-0',
  'h-8 min-h-8 text-[0.8125rem] leading-tight text-slate-900',
  'shadow-none transition-[border-color,box-shadow] duration-150 ease-out',
  'focus:outline-none focus-visible:border-[var(--ui-border-focus)] focus-visible:ring-1 focus-visible:ring-slate-900/[0.06]',
  'disabled:cursor-not-allowed disabled:bg-[var(--ui-surface-muted)] disabled:text-slate-400',
  'px-3',
  chevron,
);

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, quiet: _quiet = false, disabled, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn(
        base,
        invalid
          ? 'border-[var(--color-danger-border)] focus-visible:border-[var(--color-danger-text-emphasis)] focus-visible:ring-red-900/10'
          : 'border-[var(--ui-border)] hover:enabled:border-[var(--ui-border-hover)]',
        className,
      )}
      {...props}
    />
  );
});
