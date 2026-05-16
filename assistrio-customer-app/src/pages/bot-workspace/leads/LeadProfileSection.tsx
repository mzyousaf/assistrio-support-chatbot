import type { CustomerLeadFieldDefinition } from '@/api/types';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
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
  visibleLeadFieldDefinitions,
} from './leadsUiHelpers';

type Props = {
  definitions: CustomerLeadFieldDefinition[];
  capturedLeadData: Record<string, string> | undefined;
};

function LeadFieldLifecycleTag({ definition }: { definition: CustomerLeadFieldDefinition }) {
  const st = inferLeadFieldStatus(definition);
  if (st === 'active') return null;

  const isDeleted = st === 'deleted';
  const shortLabel = isDeleted ? 'Deleted' : 'Inactive';
  const explanation = isDeleted
    ? 'This field was removed from lead capture settings. The value shown was saved earlier or from historical lead data.'
    : 'This field was inactive or disabled in lead capture settings when this value was saved.';

  return (
    <Tooltip
      content={<span className="text-[13px] font-normal leading-snug">{explanation}</span>}
      side="top"
      panelClassName="max-w-[min(20rem,calc(100vw-24px))]"
    >
      <span
        className={cn(
          'inline-flex cursor-help rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal-600)]/35',
          isDeleted
            ? 'bg-rose-50 text-rose-900 ring-rose-200/75'
            : 'bg-amber-100 text-amber-900 ring-amber-200/75',
        )}
        tabIndex={0}
      >
        {shortLabel}
      </span>
    </Tooltip>
  );
}

function renderFieldRows(definitions: CustomerLeadFieldDefinition[], capturedLeadData: Record<string, string> | undefined) {
  const ordered = visibleLeadFieldDefinitions(definitions);
  return ordered.map((d) => {
    const raw = formatLeadCellValue(capturedLeadData, d.key);
    const display = displayLeadFieldValue(capturedLeadData, d.key);
    const missing = display === '—';
    const copyable = Boolean(raw && leadDetailFieldRowShouldOfferCopy(d, raw));
    const lbl = leadDetailFieldLabel(d);
    const labelCell = (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span>{lbl}</span>
        <LeadFieldLifecycleTag definition={d} />
      </span>
    );

    return (
      <ConversationInsightsSheetRow
        key={d.key}
        label={labelCell}
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
  return (
    <ConversationInsightsSheetSection title="Captured fields" className={leadDetailSheetSectionClassName}>
      {renderFieldRows(definitions, capturedLeadData)}
    </ConversationInsightsSheetSection>
  );
}
