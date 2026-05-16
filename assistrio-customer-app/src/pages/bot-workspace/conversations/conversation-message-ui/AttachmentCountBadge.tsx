import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AttachmentCountBadgeProps {
  count: number;
  dark?: boolean;
  onAccent?: boolean;
  embedded?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Paperclip + count (duplicated from chat-widget for customer dashboard). */
export function AttachmentCountBadge({
  count,
  dark = true,
  onAccent = false,
  embedded = false,
  onClick,
  className,
}: AttachmentCountBadgeProps) {
  if (count < 1) return null;
  const label = count === 1 ? '1 attachment' : `${count} attachments`;
  const body = (
    <>
      <Paperclip
        className={cn('shrink-0 opacity-90', embedded ? 'h-[17px] w-[17px]' : 'h-3.5 w-3.5')}
        strokeWidth={2}
        aria-hidden
      />
      <span>{count}</span>
    </>
  );
  const shellClass = cn(
    'inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums leading-none',
    embedded
      ? 'gap-0.5 px-0 py-0 text-current'
      : cn(
          'rounded-full border px-1.5 py-0.5',
          onAccent
            ? 'border-white/35 bg-white/15 text-white'
            : dark
              ? 'border-gray-500/60 bg-gray-800/90 text-gray-200'
              : 'border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-slate-700',
        ),
    onClick && !embedded && 'cursor-pointer transition-opacity hover:opacity-90',
    className,
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          shellClass,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          dark ? 'focus-visible:ring-offset-gray-900' : 'focus-visible:ring-offset-white',
        )}
        title={label}
        aria-label={label}
      >
        {body}
      </button>
    );
  }
  return (
    <span
      className={shellClass}
      {...(embedded ? { 'aria-hidden': true as const } : { title: label, 'aria-label': label })}
    >
      {body}
    </span>
  );
}
