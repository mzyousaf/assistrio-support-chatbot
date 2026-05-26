import { cn } from '@/lib/utils';

const base = cn(
  'inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap no-underline',
  'rounded-[var(--ui-radius)] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-surface)]',
);

/** NavLink / anchor styled like {@link Button} for settings pages. */
export function settingsNavButtonClassName(variant: 'primary' | 'secondary' = 'secondary', size: 'sm' | 'md' = 'sm') {
  const sizeClass = size === 'sm' ? 'h-7 px-2.5 text-xs leading-none' : 'h-8 px-3 text-[0.8125rem] leading-tight';
  if (variant === 'primary') {
    return cn(
      base,
      sizeClass,
      'border border-transparent bg-[var(--color-teal-600)] text-white shadow-none',
      'hover:bg-[var(--color-teal-700)] active:bg-[var(--color-teal-800)]',
      'focus-visible:ring-teal-600/25',
    );
  }
  return cn(
    base,
    sizeClass,
    'border border-[var(--ui-border)] bg-[var(--ui-surface)] text-slate-800 shadow-none',
    'hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]',
    'active:bg-slate-100/90',
    'focus-visible:ring-slate-900/12',
  );
}
