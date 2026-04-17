import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const base = cn(
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap',
  'rounded-[var(--ui-radius)] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-surface)]',
  'disabled:pointer-events-none disabled:opacity-50',
);

const variants: Record<Variant, string> = {
  primary: cn(
    'border border-transparent bg-[var(--color-teal-600)] text-white shadow-none',
    'hover:enabled:bg-[var(--color-teal-700)] active:enabled:bg-[var(--color-teal-800)]',
    'focus-visible:ring-teal-600/25',
  ),
  secondary: cn(
    'border border-[var(--ui-border)] bg-[var(--ui-surface)] text-slate-800 shadow-none',
    'hover:enabled:border-[var(--ui-border-hover)] hover:enabled:bg-[var(--ui-surface-muted)]',
    'active:enabled:bg-slate-100/90',
    'focus-visible:ring-slate-900/12',
  ),
  ghost: cn(
    'border border-transparent bg-transparent text-slate-600 shadow-none',
    'hover:enabled:bg-slate-100/70 hover:enabled:text-slate-900',
    'active:enabled:bg-slate-100',
    'focus-visible:ring-slate-900/10',
  ),
  danger: cn(
    'border border-transparent bg-[var(--color-danger-text-emphasis)] text-white shadow-none',
    'hover:enabled:bg-[var(--color-danger-text)] active:enabled:opacity-95',
    'focus-visible:ring-red-600/25',
  ),
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs leading-none',
  md: 'h-8 px-3 text-[0.8125rem] leading-tight',
  lg: 'h-9 px-4 text-sm leading-tight',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-ui-button=""
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});
