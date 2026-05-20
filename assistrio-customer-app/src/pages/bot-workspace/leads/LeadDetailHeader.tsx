import type { CustomerLeadDetail, CustomerLeadFieldDefinition } from '@/api/types';
import { SquareArrowOutUpRight } from 'lucide-react';
import { Button, Tooltip } from '@/components/ui';
import { formatConversationDateTimeDetailed } from '@/lib/conversationDateFormat';
import { ConversationStartedFromBadge } from '../conversations/ConversationStartedFromBadge';
import { leadPrimaryIdentity, leadQualityFromCaptured } from './leadsUiHelpers';
import { LeadQualityBadge } from './LeadQualityBadge';

type Props = {
  detail: CustomerLeadDetail;
  fieldDefinitions: CustomerLeadFieldDefinition[];
  onOpenConversation: () => void;
};

export function LeadDetailHeader({ detail, fieldDefinitions, onOpenConversation }: Props) {
  const identity = leadPrimaryIdentity(detail.capturedLeadData, detail.conversationId, fieldDefinitions);
  const q = leadQualityFromCaptured(detail.capturedLeadData, fieldDefinitions);
  const unknown = identity.headline === 'Unknown lead';
  const conversationIdTrim = detail.conversationId?.trim() ?? '';
  const sublineTrim = identity.subline.trim();
  const showIdentitySubline =
    sublineTrim.length > 0 &&
    sublineTrim !== '—' &&
    sublineTrim !== conversationIdTrim;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="min-w-0 max-w-full">
        {unknown ? (
          <p className="m-0 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-snug tracking-tight text-slate-600 sm:text-2xl">
            {identity.headline}
          </p>
        ) : (
          <Tooltip
            content={identity.headline}
            side="bottom"
            fullWidth
            panelClassName="max-w-sm whitespace-normal break-words text-xs"
          >
            <span className="block min-w-0 w-full cursor-default overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl">
              {identity.headline}
            </span>
          </Tooltip>
        )}
        {showIdentitySubline ? (
          <p
            className="m-0 mt-1 min-w-0 text-sm leading-snug text-slate-600 [overflow-wrap:anywhere]"
            title={identity.subline}
          >
            {identity.subline}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <LeadQualityBadge kind={q.kind} label={q.label} />
        {detail.startedFrom ? <ConversationStartedFromBadge startedFrom={detail.startedFrom} /> : null}
      </div>

      <p className="m-0 text-xs text-slate-500">
        Captured{' '}
        <span className="font-medium text-slate-700">{formatConversationDateTimeDetailed(detail.leadCapturedAt)}</span>
      </p>

      <Button
        type="button"
        variant="primary"
        size="sm"
        className="inline-flex w-auto shrink-0 items-center justify-center gap-1.5 self-start"
        onClick={onOpenConversation}
      >
        <SquareArrowOutUpRight size={15} strokeWidth={2} aria-hidden />
        Open chat log
      </Button>
    </div>
  );
}
