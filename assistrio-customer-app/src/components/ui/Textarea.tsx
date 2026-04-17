import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  quiet?: boolean;
};

const base = cn(
  'block w-full resize-y rounded-[var(--ui-radius)] border bg-[var(--ui-surface)] px-3 py-2 shadow-none',
  'text-[0.8125rem] leading-relaxed text-slate-900 placeholder:text-slate-400',
  'transition-[border-color,box-shadow] duration-150 ease-out',
  'focus:outline-none focus-visible:border-[var(--color-teal-600)] focus-visible:ring-1 focus-visible:ring-[color-mix(in_oklab,var(--color-teal-600)_22%,transparent)]',
  'disabled:cursor-not-allowed disabled:bg-[var(--ui-surface-muted)] disabled:text-slate-400',
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, quiet: _quiet = false, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        base,
        invalid
          ? 'border-[var(--color-danger-border)] focus-visible:border-[var(--color-danger-text-emphasis)] focus-visible:ring-red-900/10'
          : 'border-[var(--ui-border)] hover:border-[var(--ui-border-hover)]',
        className,
      )}
      {...props}
    />
  );
});
