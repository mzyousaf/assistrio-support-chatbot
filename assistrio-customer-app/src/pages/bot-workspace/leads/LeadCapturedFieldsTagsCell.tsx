import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import {
  LEADS_CAPTURED_FIELD_TAG_DISPLAY_MAX,
  leadCapturedFieldTagItemsForRow,
} from './leadsUiHelpers';

type Props = {
  lead: CustomerLeadListItem;
  fieldDefinitions: CustomerLeadFieldDefinition[];
  /** Keys to omit from tags (tests only; leads table lists every captured field). */
  excludeFieldKeys?: string[];
};

const fieldTagClassName =
  'inline-flex h-6 max-h-6 max-w-[min(100%,14rem)] min-w-0 shrink-0 items-center rounded-full border border-[var(--color-teal-600)] bg-[var(--teal-50)] px-1.5 text-[0.625rem] font-medium leading-none text-[var(--color-teal-800)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--teal-50)_92%,var(--color-teal-600)_8%)]';

const overflowTagClassName =
  'inline-flex h-6 max-h-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-teal-600)] bg-[var(--teal-50)] px-1.5 text-[0.625rem] font-medium tabular-nums leading-none text-[var(--color-teal-800)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--teal-50)_92%,var(--color-teal-600)_8%)]';

export function LeadCapturedFieldsTagsCell({
  lead,
  fieldDefinitions,
  excludeFieldKeys = [],
}: Props) {
  const items = leadCapturedFieldTagItemsForRow(lead.capturedLeadData, fieldDefinitions, excludeFieldKeys);
  if (items.length === 0) {
    return <span className="text-xs text-slate-400 sm:text-sm">—</span>;
  }

  const shown = items.slice(0, LEADS_CAPTURED_FIELD_TAG_DISPLAY_MAX);
  const overflow = items.length - shown.length;
  const hiddenLabels = overflow > 0 ? items.slice(LEADS_CAPTURED_FIELD_TAG_DISPLAY_MAX).map((i) => i.label) : [];

  const shownLabels = shown.map((i) => i.label);
  const ariaLabel =
    overflow > 0
      ? `Captured fields: ${shownLabels.join(', ')}. ${overflow} additional fields.`
      : `Captured fields: ${shownLabels.join(', ')}`;

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      role="list"
      aria-label={ariaLabel}
    >
      {shown.map((item) => (
        <span key={item.key} role="listitem" title={item.label} className={fieldTagClassName}>
          <span className="min-w-0 truncate">{item.label}</span>
        </span>
      ))}
      {overflow > 0 ? (
        <span
          role="listitem"
          title={hiddenLabels.join(', ')}
          className={overflowTagClassName}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
