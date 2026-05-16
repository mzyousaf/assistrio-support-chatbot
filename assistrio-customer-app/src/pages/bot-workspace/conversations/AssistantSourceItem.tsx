import type { CustomerConversationMessageSource } from '@/api/types';
import { AssistantRetrievalConfidencePill } from './AssistantRetrievalConfidencePill';
import { AssistantSourceTypeBadge } from './AssistantSourceTypeBadge';
import { clampSourcePreview, displayNameFromHttpUrl, safeSourceHttpUrl, sourceDisplayTitle } from './sourceDisplayShared';

type Props = { source: CustomerConversationMessageSource };

export function AssistantSourceItem({ source }: Props) {
  const preview = clampSourcePreview(source.preview);
  const href = safeSourceHttpUrl(source.sourceUrl);
  const primary = sourceDisplayTitle(source).trim();
  const urlLabel = href ? displayNameFromHttpUrl(source.sourceUrl) : null;
  const linkLabel = primary || urlLabel || 'Open link';
  const showTitleBlock = Boolean(primary || href);

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AssistantSourceTypeBadge
          sourceType={source.sourceType}
          retrievalScore={source.score}
          applyWeakScoreBehaviour={false}
        />
        <AssistantRetrievalConfidencePill score={source.score} />
      </div>
      {showTitleBlock ? (
        <div className="mt-2 min-w-0">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-sm font-medium text-teal-700 underline decoration-teal-600/40 underline-offset-2 hover:text-teal-800"
            >
              {linkLabel}
            </a>
          ) : (
            <p className="m-0 break-words text-sm font-medium text-slate-900">{primary}</p>
          )}
          {urlLabel && href && primary && primary !== urlLabel ? (
            <p className="m-0 mt-0.5 break-all text-[11px] text-slate-500">{urlLabel}</p>
          ) : null}
        </div>
      ) : null}
      {preview ? (
        <p className="m-0 mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{preview}</p>
      ) : null}
    </li>
  );
}
