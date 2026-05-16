import { useNavigate } from 'react-router-dom';
import { SquareArrowOutUpRight } from 'lucide-react';
import { Button } from '@/components/ui';
import type { CustomerLeadDetail } from '@/api/types';
import { ConversationStartedFromBadge } from '../conversations/ConversationStartedFromBadge';
import { ConversationDetailCopyButton } from '../conversations/ConversationDetailCopyButton';
import {
  ConversationInsightsSheetRow,
  ConversationInsightsSheetSection,
  ConversationInsightsSheetUrlRow,
} from '../conversations/ConversationInsightsSheet';
import { INSIGHT_EM_DASH } from '../conversations/conversationInsightsFormatting';
import { customerConversationInsightsPath } from './conversationInsightsDeepLink';
import { leadDetailSheetSectionClassName } from './leadsUiHelpers';

type ConversationProps = {
  botId: string;
  detail: CustomerLeadDetail;
};

export function LeadPageSourceSection({ detail }: { detail: CustomerLeadDetail }) {
  const o = detail.conversationOrigin;
  let websiteOriginUrl: string | undefined;
  const wo = o?.websiteOrigin?.trim();
  if (wo) {
    websiteOriginUrl = /^https?:\/\//i.test(wo) ? wo : `https://${wo}`;
  }

  return (
    <ConversationInsightsSheetSection title="Page source" className={leadDetailSheetSectionClassName}>
      {o?.pageUrl?.trim() ? (
        <ConversationInsightsSheetUrlRow label="Page URL" url={o.pageUrl} />
      ) : (
        <ConversationInsightsSheetRow label="Page URL" value={INSIGHT_EM_DASH} />
      )}
      {websiteOriginUrl ? (
        <ConversationInsightsSheetUrlRow label="Website origin" url={websiteOriginUrl} />
      ) : (
        <ConversationInsightsSheetRow label="Website origin" value={INSIGHT_EM_DASH} />
      )}
      {o?.referrer?.trim() ? (
        <ConversationInsightsSheetUrlRow label="Referrer URL" url={o.referrer} />
      ) : (
        <ConversationInsightsSheetRow label="Referrer URL" value={INSIGHT_EM_DASH} />
      )}
    </ConversationInsightsSheetSection>
  );
}

export function LeadConversationSection({ botId, detail }: ConversationProps) {
  const navigate = useNavigate();

  return (
    <ConversationInsightsSheetSection
      title="Conversation"
      className={leadDetailSheetSectionClassName}
      footer={
        <Button
          type="button"
          variant="outlinePrimary"
          size="sm"
          className="!h-8 w-full gap-1.5 sm:w-auto"
          onClick={() => navigate(customerConversationInsightsPath(botId, detail.conversationId))}
        >
          <SquareArrowOutUpRight size={15} strokeWidth={2} aria-hidden />
          Open conversation
        </Button>
      }
    >
      <ConversationInsightsSheetRow
        label="Source"
        value={
          detail.startedFrom ? (
            <ConversationStartedFromBadge startedFrom={detail.startedFrom} />
          ) : (
            INSIGHT_EM_DASH
          )
        }
      />
      <ConversationInsightsSheetRow
        label="Conversation ID"
        value={
          <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-all font-mono text-[12px] text-slate-900">{detail.conversationId}</span>
            <ConversationDetailCopyButton value={detail.conversationId} ariaLabel="Copy conversation ID" />
          </span>
        }
      />
    </ConversationInsightsSheetSection>
  );
}
