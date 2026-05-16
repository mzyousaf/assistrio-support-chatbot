import type { CustomerLeadConversationOrigin } from '@/api/types';
import { ConversationStartedFromBadge } from '../conversations/ConversationStartedFromBadge';
import { formatLeadSourcePage, formatLeadUrlInboxDisplay } from './leadsUiHelpers';

type Props = {
  startedFrom: string | null;
  origin: CustomerLeadConversationOrigin | null;
};

export function LeadSourceCell({ startedFrom, origin }: Props) {
  const full = formatLeadSourcePage(origin);
  const domain = origin?.websiteOrigin?.trim();
  const hasPage = full !== '—';
  const display = hasPage ? formatLeadUrlInboxDisplay(full) : domain ? formatLeadUrlInboxDisplay(domain) || domain : '—';
  const titleLine = hasPage ? full : domain || '';
  const started = startedFrom?.trim() ?? '';
  /** Playground has no visitor page URL; avoid implying data is missing. */
  const skipNoPageLine = started === 'playground_preview';

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <ConversationStartedFromBadge startedFrom={startedFrom} />
      </div>
      {display !== '—' ? (
        <p className="m-0 line-clamp-2 text-xs leading-snug text-slate-600" title={titleLine || undefined}>
          {display}
        </p>
      ) : skipNoPageLine ? null : (
        <p className="m-0 text-xs text-slate-400">No page context</p>
      )}
    </div>
  );
}
