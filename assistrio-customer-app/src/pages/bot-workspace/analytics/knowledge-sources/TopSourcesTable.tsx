import { ExternalLink } from 'lucide-react';
import type { CustomerTopKnowledgeSourceItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsScore } from '@/lib/analyticsFormat';
import { isPublicHttpUrl } from '@/lib/publicHttpUrl';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';

function formatLastUsed(iso: string | null | undefined): string {
  const s = typeof iso === 'string' ? iso.trim() : '';
  if (!s) return '—';
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceDisplayTitle(row: CustomerTopKnowledgeSourceItem): string {
  const t = safeClientString(row.sourceTitle, '').trim();
  if (t) return t;
  if (row.knowledgeBaseItemId) return `Knowledge item ${row.knowledgeBaseItemId}`;
  return 'Untitled source';
}

type Props = { rows: CustomerTopKnowledgeSourceItem[] };

export function TopSourcesTable({ rows }: Props) {
  if (!rows.length) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/40 px-4 text-center text-sm text-slate-500">
        No individual sources ranked for this range
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Source</th>
            <th className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Type</th>
            <th className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Uses</th>
            <th className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Messages
            </th>
            <th className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Avg score
            </th>
            <th className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last used</th>
            <th className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const title = sourceDisplayTitle(row);
            const rawUrl = row.sourceUrl?.trim() ? row.sourceUrl.trim() : null;
            const url = rawUrl && isPublicHttpUrl(rawUrl) ? rawUrl : null;
            return (
              <tr key={`${row.knowledgeBaseItemId ?? ''}-${title}-${i}`} className="border-b border-slate-50 last:border-b-0">
                <td className="max-w-[220px] py-2.5 pr-3">
                  <span className="line-clamp-2 font-medium text-slate-800" title={title}>
                    {title}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-slate-600 capitalize">{row.sourceType.replace(/_/g, ' ')}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-800">{formatAnalyticsInteger(row.sourceUses)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-800">
                  {formatAnalyticsInteger(row.assistantMessages)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{formatAnalyticsScore(row.averageScore)}</td>
                <td className="py-2.5 pr-3 text-slate-600">{formatLastUsed(row.lastUsedAt)}</td>
                <td className="py-2.5">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-1 text-teal-700 underline decoration-teal-600/30 underline-offset-2',
                        'hover:text-teal-800',
                      )}
                    >
                      Open
                      <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
