import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './Label';

type Props = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: ReactNode;
  labelAddon?: ReactNode;
  /** Classes for the label + `labelAddon` row (e.g. `gap-1` to sit icons closer to the label). */
  labelRowClassName?: string;
  error?: string | null;
  disabled?: boolean;
  disabledNote?: string;
  className?: string;
  children: ReactNode;
};

export function FieldRow({
  label,
  htmlFor,
  required,
  helperText,
  labelAddon,
  labelRowClassName,
  error,
  disabled,
  disabledNote,
  className,
  children,
}: Props) {
  const autoId = useId();
  const id = htmlFor ?? autoId;

  return (
    <div className={cn('flex flex-col gap-1.5', disabled && 'opacity-[0.72]', className)}>
      <div className={cn('flex w-full min-h-[1.125rem] items-center gap-2', labelRowClassName)}>
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        {labelAddon}
      </div>

      {helperText ? (
        <p className="m-0 text-[0.75rem] leading-snug text-slate-500">{helperText}</p>
      ) : null}

      <div>{children}</div>

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
