import type { CustomerLeadFieldDefinition } from '@/api/types';
import { ConversationDetailCopyButton } from '../conversations/ConversationDetailCopyButton';
import {
  ConversationInsightsSheetRow,
  ConversationInsightsSheetSection,
} from '../conversations/ConversationInsightsSheet';
import { INSIGHT_EM_DASH } from '../conversations/conversationInsightsFormatting';
import { LeadValueCell } from './LeadValueCell';
import {
  displayLeadFieldValue,
  formatLeadCellValue,
  leadColumnHeaderLabel,
  leadDetailFieldRowShouldOfferCopy,
  leadDetailSheetSectionClassName,
} from './leadsUiHelpers';

type Props = {
  definitions: CustomerLeadFieldDefinition[];
  capturedLeadData: Record<string, string> | undefined;
};

export function LeadProfileSection({ definitions, capturedLeadData }: Props) {
  return (
    <ConversationInsightsSheetSection title="Captured fields" className={leadDetailSheetSectionClassName}>
      {definitions.map((d) => {
        const raw = formatLeadCellValue(capturedLeadData, d.key);
        const display = displayLeadFieldValue(capturedLeadData, d.key);
        const missing = display === '—';
        const copyable = Boolean(raw && leadDetailFieldRowShouldOfferCopy(d, raw));

        return (
          <ConversationInsightsSheetRow
            key={d.key}
            label={leadColumnHeaderLabel(d)}
            value={
              missing ? (
                INSIGHT_EM_DASH
              ) : (
                <span className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 text-[13px] leading-snug">
                    <LeadValueCell field={d} data={capturedLeadData} />
                  </span>
                  {copyable ? (
                    <ConversationDetailCopyButton value={raw} ariaLabel={`Copy ${leadColumnHeaderLabel(d)}`} className="h-7" />
                  ) : null}
                </span>
              )
            }
          />
        );
      })}
    </ConversationInsightsSheetSection>
  );
}
