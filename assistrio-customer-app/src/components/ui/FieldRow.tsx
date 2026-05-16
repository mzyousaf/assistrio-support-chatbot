import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './Label';

type Props = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: ReactNode;
  /** Rendered immediately after the label (e.g. info tooltip trigger). */
  labelTrailing?: ReactNode;
  labelAddon?: ReactNode;
  /** Classes for the label row (e.g. `gap-1` to tighten spacing). */
  labelRowClassName?: string;
  error?: string | null;
  disabled?: boolean;
  disabledNote?: string;
  className?: string;
  /** Applied to the wrapper around `children` (e.g. stretch a textarea to fill flex space). */
  controlClassName?: string;
  children: ReactNode;
};

export function FieldRow({
  label,
  htmlFor,
  required,
  helperText,
  labelTrailing,
  labelAddon,
  labelRowClassName,
  error,
  disabled,
  disabledNote,
  className,
  controlClassName,
  children,
}: Props) {
  const autoId = useId();
  const id = htmlFor ?? autoId;

  return (
    <div className={cn('flex flex-col gap-1.5', disabled && 'opacity-[0.72]', className)}>
      <div className={cn('flex w-full min-h-[1.125rem] items-center justify-between gap-4', labelRowClassName)}>
        <div className="flex min-w-0 items-center gap-1">
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
          {labelTrailing}
        </div>
        {labelAddon}
      </div>

      {helperText ? (
        <p className="m-0 text-[0.75rem] leading-snug text-slate-500">{helperText}</p>
      ) : null}

      <div className={cn(controlClassName)}>{children}</div>

      {disabled && disabledNote ? (
        <p className="m-0 text-[0.6875rem] leading-snug text-slate-400">{disabledNote}</p>
      ) : null}
      {error ? (
        <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-danger-text-emphasis)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
