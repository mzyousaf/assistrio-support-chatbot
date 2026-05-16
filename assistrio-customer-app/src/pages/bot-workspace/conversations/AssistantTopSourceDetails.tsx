import type { CustomerConversationMessageSource } from '@/api/types';
import { cn } from '@/lib/utils';
import { AssistantRetrievalConfidencePill } from './AssistantRetrievalConfidencePill';
import { AssistantSourceTypeBadge } from './AssistantSourceTypeBadge';
import { clampSourcePreview, displayNameFromHttpUrl, safeSourceHttpUrl, sourceDisplayTitle } from './sourceDisplayShared';

const DETAIL_PREVIEW_MAX = 2000;

type Props = {
  source: CustomerConversationMessageSource;
  className?: string;
};

export function AssistantTopSourceDetails({ source, className }: Props) {
  const preview = clampSourcePreview(source.preview, DETAIL_PREVIEW_MAX);
  const href = safeSourceHttpUrl(source.sourceUrl);
  const primary = sourceDisplayTitle(source).trim();
  const urlLabel = href ? displayNameFromHttpUrl(source.sourceUrl) : null;
  const linkLabel = primary || urlLabel || 'Open link';
  const showTitleBlock = Boolean(primary || href);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <AssistantSourceTypeBadge sourceType={source.sourceType} retrievalScore={source.score} />
        <AssistantRetrievalConfidencePill score={source.score} />
      </div>
      {showTitleBlock ? (
        <div className="min-w-0">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-sm font-semibold text-teal-700 underline decoration-teal-600/40 underline-offset-2 hover:text-teal-800"
            >
              {linkLabel}
            </a>
          ) : (
            <p className="m-0 break-words text-sm font-semibold text-slate-900">{primary}</p>
          )}
          {urlLabel && href && primary && primary !== urlLabel ? (
            <p className="m-0 mt-0.5 break-all text-[11px] text-slate-500">{urlLabel}</p>
          ) : null}
        </div>
      ) : null}
      {preview ? (
        <pre className="m-0 max-h-[min(40vh,16rem)] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-100 bg-slate-50/90 p-3 text-xs leading-relaxed text-slate-700">
          {preview}
        </pre>
      ) : null}
    </div>
  );
}
