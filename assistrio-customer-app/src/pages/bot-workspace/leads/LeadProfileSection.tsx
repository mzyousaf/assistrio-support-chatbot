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
  inferLeadFieldStatus,
  leadDetailFieldLabel,
  leadDetailFieldRowShouldOfferCopy,
  leadDetailSheetSectionClassName,
} from './leadsUiHelpers';

type Props = {
  definitions: CustomerLeadFieldDefinition[];
  capturedLeadData: Record<string, string> | undefined;
};

function renderFieldRows(definitions: CustomerLeadFieldDefinition[], capturedLeadData: Record<string, string> | undefined) {
  return definitions.map((d) => {
    const raw = formatLeadCellValue(capturedLeadData, d.key);
    const display = displayLeadFieldValue(capturedLeadData, d.key);
    const missing = display === '—';
    const copyable = Boolean(raw && leadDetailFieldRowShouldOfferCopy(d, raw));
    const lbl = leadDetailFieldLabel(d);

    return (
      <ConversationInsightsSheetRow
        key={d.key}
        label={lbl}
        value={
          missing ? (
            INSIGHT_EM_DASH
          ) : (
            <span className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
              <span className="min-w-0 flex-1 text-[13px] leading-snug">
                <LeadValueCell field={d} data={capturedLeadData} />
              </span>
              {copyable ? (
                <ConversationDetailCopyButton value={raw} ariaLabel={`Copy ${lbl}`} className="h-7" />
              ) : null}
            </span>
          )
        }
      />
    );
  });
}

export function LeadProfileSection({ definitions, capturedLeadData }: Props) {
  const active = definitions.filter((d) => inferLeadFieldStatus(d) === 'active');
  const removedOrInactive = definitions.filter((d) => inferLeadFieldStatus(d) !== 'active');

  return (
    <>
      <ConversationInsightsSheetSection title="Captured fields" className={leadDetailSheetSectionClassName}>
        {renderFieldRows(active, capturedLeadData)}
      </ConversationInsightsSheetSection>
      {removedOrInactive.length ? (
        <ConversationInsightsSheetSection
          title="Removed & inactive fields"
          className={leadDetailSheetSectionClassName}
        >
          <p className="mb-3 mt-0 text-xs leading-relaxed text-slate-500">
            Values saved historically while the field was inactive, disabled, or before it was removed from lead capture
            settings.
          </p>
          {renderFieldRows(removedOrInactive, capturedLeadData)}
        </ConversationInsightsSheetSection>
      ) : null}
    </>
  );
}
