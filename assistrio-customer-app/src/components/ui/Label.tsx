import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, required, children, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn(
        'text-[0.8125rem] font-medium leading-tight tracking-[-0.01em] text-slate-800',
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-[var(--color-danger-text-emphasis)]" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
});
