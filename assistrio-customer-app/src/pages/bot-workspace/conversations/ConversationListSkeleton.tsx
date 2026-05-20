import { cn } from '@/lib/utils';

type Props = { rows?: number; className?: string };

export function ConversationListSkeleton({ rows = 6, className }: Props) {
  return (
    <ul className={cn('m-0 list-none space-y-2 p-2', className)} aria-busy aria-label="Loading chats">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3"
        >
          <div className="h-4 w-[88%] rounded bg-slate-200/90" />
          <div className="mt-2 h-3 w-[55%] rounded bg-slate-200/70" />
          <div className="mt-3 flex justify-between gap-2">
            <div className="h-3 w-16 rounded bg-slate-200/60" />
            <div className="h-3 w-20 rounded bg-slate-200/60" />
          </div>
        </li>
      ))}
    </ul>
  );
}
