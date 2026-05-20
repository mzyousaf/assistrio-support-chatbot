import { cn } from '@/lib/utils';

type Props = {
  /** Accessible name for the loading region */
  ariaLabel?: string;
  className?: string;
};

export function TranscriptLoadingSkeleton({ ariaLabel = 'Loading messages', className }: Props) {
  const bar = (align: 'start' | 'end', w: string, h: string) => (
    <div className={cn('flex w-full', align === 'end' ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('max-w-[min(100%,22rem)] animate-pulse rounded-2xl bg-slate-200/90', w, h)}
        aria-hidden
      />
    </div>
  );
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-3 px-4 py-4', className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {bar('end', 'w-[82%]', 'h-10')}
      {bar('start', 'w-[92%]', 'h-14')}
      {bar('end', 'w-[58%]', 'h-10')}
      {bar('start', 'w-[76%]', 'h-12')}
      {bar('end', 'w-[72%]', 'h-9')}
    </div>
  );
}
