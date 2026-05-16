import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';

export type LeadsVolumeRankingRow = {
  id: 'conversations' | 'leads';
  label: string;
  color: string;
  count: number;
};

type Props = {
  rows: LeadsVolumeRankingRow[];
  hiddenSeriesIds: string[];
  onToggleSeries: (id: LeadsVolumeRankingRow['id']) => void;
};

export function LeadsVolumeRankingCard({ rows, hiddenSeriesIds, onToggleSeries }: Props) {
  if (!rows.length) {
    return <p className="m-0 px-2 py-4 text-center text-sm text-slate-500">No activity for this range.</p>;
  }

  return (
    <ul className="m-0 list-none space-y-1 p-0 py-0.5">
      {rows.map((row) => {
        const hidden = hiddenSeriesIds.includes(row.id);
        const countStr = formatAnalyticsInteger(row.count);
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onToggleSeries(row.id)}
              aria-pressed={!hidden}
              aria-label={`${row.label}: ${countStr}`}
              className={cn(
                'flex min-h-[2.5rem] w-full min-w-0 flex-col rounded-lg border border-transparent px-2 py-2 text-left transition-colors duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25',
                'hover:border-slate-200/90 hover:bg-white/90',
                'active:bg-slate-100/80',
                hidden && 'opacity-45',
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white drop-shadow-sm"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
                <p className="m-0 min-w-0 flex-1 truncate text-xs font-semibold leading-snug text-slate-900">
                  {row.label}
                </p>
                <p className="m-0 shrink-0 text-xs font-semibold tabular-nums leading-snug text-slate-900">
                  {countStr}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
