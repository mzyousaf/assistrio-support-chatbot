import type { AdminConversationMessageSource } from '@/api/types';
import { cn } from '@/lib/utils';
import {
  INLINE_SOURCES_LIMIT,
  inlineSources,
  sourcesForDisplay,
} from './conversationSourcesDisplay';
import { sourceDisplayTitle, clampSourcePreview } from './sourceDisplayShared';

type Props = {
  sources?: AdminConversationMessageSource[] | null;
  onViewAll: () => void;
  className?: string;
};

export function AssistantSourcesInlineList({ sources, onViewAll, className }: Props) {
  const sorted = sourcesForDisplay(sources);
  if (!sorted.length) return null;

  const shown = inlineSources(sorted);
  const hasMore = sorted.length > INLINE_SOURCES_LIMIT;

  return (
    <div
      className={cn('mt-2 w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2.5', className)}
      data-testid="assistant-sources-inline"
    >
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sources used</p>
      <ul className="m-0 mt-2 list-none space-y-2 pl-0" role="list">
        {shown.map((s, i) => {
          const title = sourceDisplayTitle(s).trim() || 'Untitled source';
          const preview = clampSourcePreview(s.preview, 160);
          return (
            <li key={`${s.chunkId ?? ''}-${s.knowledgeBaseItemId ?? ''}-${i}`} className="min-w-0">
              <p className="m-0 text-xs font-medium text-slate-900">
                <span className="text-slate-500">Source {i + 1} · </span>
                {title}
              </p>
              {preview ? (
                <p className="m-0 mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{preview}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-teal-700 underline-offset-2 hover:text-teal-800 hover:underline"
          onClick={onViewAll}
        >
          View all sources
        </button>
      ) : null}
    </div>
  );
}
