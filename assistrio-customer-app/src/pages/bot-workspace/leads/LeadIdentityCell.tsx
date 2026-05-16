import type { CustomerLeadListItem } from '@/api/types';
import { leadPrimaryIdentity } from './leadsUiHelpers';

type Props = {
  lead: CustomerLeadListItem;
};

export function LeadIdentityCell({ lead }: Props) {
  const { headline, subline } = leadPrimaryIdentity(lead.capturedLeadData, lead.conversationId);
  const unknown = headline === 'Unknown lead';

  return (
    <div className="min-w-0">
      <p
        className={`m-0 min-w-0 truncate text-sm font-semibold leading-snug ${unknown ? 'text-slate-500' : 'text-slate-900'}`}
        title={headline}
      >
        {headline}
      </p>
      <p
        className="m-0 mt-0.5 min-w-0 text-xs tabular-nums leading-snug text-slate-500 [overflow-wrap:anywhere]"
        title={subline}
      >
        {subline}
      </p>
    </div>
  );
}
