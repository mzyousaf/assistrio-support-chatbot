import { cn } from '@/lib/utils';

export function BotStatusBadge({ status }: { status: string }) {
  const v = (status || '').toLowerCase();
  if (v === 'published') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700',
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        Live
      </span>
    );
  }
  if (v === 'draft') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-700',
        )}
      >
        <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
        Draft
      </span>
    );
  }
  return <span className="text-[0.8125rem] text-slate-600">{status || '—'}</span>;
}
