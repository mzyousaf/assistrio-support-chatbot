import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, checked, disabled, ...props },
  ref,
) {
  return (
    <span
      className={cn(
        'group/checkbox relative inline-flex h-4 w-4 shrink-0 items-center justify-center',
        'rounded-[3px] border transition-[border-color,background-color] duration-150 ease-out',
        checked
          ? 'border-[var(--color-teal-600)] bg-[var(--color-teal-600)]'
          : 'border-slate-300 bg-[var(--ui-surface)]',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        !disabled &&
          !checked &&
          'hover:border-slate-400 hover:bg-[var(--ui-surface-muted)]',
        className,
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="absolute inset-0 cursor-[inherit] appearance-none opacity-0"
        {...props}
      />
      {checked ? (
        <Check size={11} strokeWidth={2.75} className="pointer-events-none text-white" aria-hidden />
      ) : null}
    </span>
  );
});
