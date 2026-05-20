import type { AdminConversationMessageSource } from '@/api/types';
import { clampSourcePreview, displayNameFromHttpUrl, safeSourceHttpUrl, sourceDisplayTitle } from './sourceDisplayShared';

type Props = {
  source: AdminConversationMessageSource;
  /** 1-based index shown as "Source 1", "Source 2", … */
  index: number;
};

export function AssistantSourceItem({ source, index }: Props) {
  const preview = clampSourcePreview(source.preview);
  const href = safeSourceHttpUrl(source.sourceUrl);
  const primary = sourceDisplayTitle(source).trim();
  const urlLabel = href ? displayNameFromHttpUrl(source.sourceUrl) : null;
  const linkLabel = primary || urlLabel || 'Open link';
  const showTitleBlock = Boolean(primary || href);

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      {showTitleBlock ? (
        <div className="min-w-0">
          <p className="m-0 text-sm font-medium text-slate-900">
            <span className="text-slate-500">Source {index} · </span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 underline decoration-teal-600/40 underline-offset-2 hover:text-teal-800"
              >
                {linkLabel}
              </a>
            ) : (
              linkLabel
            )}
          </p>
          {urlLabel && href && primary && primary !== urlLabel ? (
            <p className="m-0 mt-0.5 break-all text-[11px] text-slate-500">{urlLabel}</p>
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-sm font-medium text-slate-900">
          <span className="text-slate-500">Source {index}</span>
        </p>
      )}
      {preview ? (
        <p className="m-0 mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{preview}</p>
      ) : null}
    </li>
  );
}
