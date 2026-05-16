import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import { Button, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import {
  formatLeadLocationShort,
  inferLeadFieldStatus,
  isLeadsTableNameFieldColumn,
  LEADS_TABLE_LEAD_IDENTITY_COL_MAX_PX,
  LEADS_TABLE_NAME_FIELD_COL_MAX_PX,
  leadPrimaryIdentity,
  type LeadsInboxTableColumn,
} from './leadsUiHelpers';
import { customerConversationInsightsPath } from './conversationInsightsDeepLink';
import { LeadCapturedFieldsTagsCell } from './LeadCapturedFieldsTagsCell';
import { LeadStatusCell } from './LeadStatusCell';
import { LeadValueCell } from './LeadValueCell';
import { LeadSourceCell } from './LeadSourceCell';
import { Eye, SquareArrowOutUpRight } from 'lucide-react';

const actionIconBtnClass =
  '!h-7 !w-7 !min-h-0 !min-w-0 shrink-0 !rounded-md !p-0 text-slate-500 transition-colors hover:bg-[var(--color-teal-600)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal-600)]/35';

function isRowDetailClickTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('a, button, input, select, textarea, [role="button"], [role="link"]'));
}

function LeadTableIdentityCell({
  lead,
  fieldDefinitions,
}: {
  lead: CustomerLeadListItem;
  fieldDefinitions: CustomerLeadFieldDefinition[];
}) {
  const { headline, subline } = leadPrimaryIdentity(
    lead.capturedLeadData,
    lead.conversationId,
    fieldDefinitions,
  );
  const unknown = headline === 'Unknown lead';

  if (unknown) {
    return (
      <p className="m-0 min-w-0 truncate text-sm font-normal leading-snug text-slate-500" title={subline}>
        Unknown
      </p>
    );
  }

  const title = subline !== headline ? `${headline} · ${subline}` : headline;

  return (
    <p className="m-0 min-w-0 truncate text-sm font-normal leading-snug text-slate-900" title={title}>
      {headline}
    </p>
  );
}

type Props = {
  botId: string;
  lead: CustomerLeadListItem;
  leadFieldDefinitions: CustomerLeadFieldDefinition[];
  nameColumn: LeadsInboxTableColumn;
  fieldColumns: LeadsInboxTableColumn[];
  onOpenDetail: (conversationId: string) => void;
  onOpenChat: (path: string) => void;
};

export function LeadsTableRow({
  botId,
  lead,
  leadFieldDefinitions,
  nameColumn,
  fieldColumns,
  onOpenDetail,
  onOpenChat,
}: Props) {
  const nameField = nameColumn.field;
  const cap = lead.leadCapturedAt ?? lead.lastActivityAt;
  const locLine = formatLeadLocationShort(lead.location);
  const locOk = locLine !== '—';
  const abs = formatConversationAbsolute(cap);
  const rel = formatConversationRelative(cap);

  return (
    <tr
      className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
      onClick={(e) => {
        if (isRowDetailClickTarget(e.target)) return;
        onOpenDetail(lead.conversationId);
      }}
    >
      <td
        className="min-w-0 overflow-hidden py-2.5 pl-4 pr-2 align-middle sm:pl-5 sm:pr-3"
        style={{ maxWidth: LEADS_TABLE_LEAD_IDENTITY_COL_MAX_PX }}
      >
        <LeadTableIdentityCell lead={lead} fieldDefinitions={leadFieldDefinitions} />
      </td>
      <td className="min-w-0 px-2 py-2.5 align-middle tabular-nums sm:px-3">
        <span
          className="block truncate text-xs text-slate-600 sm:whitespace-normal sm:text-sm"
          title={abs}
        >
          {abs}
        </span>
        {rel !== '—' && rel !== abs ? (
          <span className="mt-0.5 block text-xs tabular-nums text-slate-500" title={abs}>
            {rel}
          </span>
        ) : null}
      </td>
      <td className="min-w-0 px-2 py-2.5 align-middle sm:px-3">
        <LeadStatusCell lead={lead} fieldDefinitions={leadFieldDefinitions} />
      </td>
      <td
        className={cn(
          'min-w-0 overflow-hidden px-2 py-2.5 align-middle sm:px-3',
          inferLeadFieldStatus(nameField) !== 'active' && 'text-slate-500',
        )}
        style={
          isLeadsTableNameFieldColumn(nameField)
            ? { maxWidth: LEADS_TABLE_NAME_FIELD_COL_MAX_PX }
            : undefined
        }
      >
        <LeadValueCell field={nameField} data={lead.capturedLeadData} suppressInteractiveLinks />
      </td>
      {fieldColumns.map(({ field: d }) => (
        <td
          key={d.key}
          className={cn(
            'min-w-0 px-2 py-2.5 align-middle sm:px-3',
            inferLeadFieldStatus(d) !== 'active' && 'text-slate-500',
          )}
          style={
            isLeadsTableNameFieldColumn(d)
              ? { maxWidth: LEADS_TABLE_NAME_FIELD_COL_MAX_PX }
              : undefined
          }
        >
          <LeadValueCell field={d} data={lead.capturedLeadData} suppressInteractiveLinks />
        </td>
      ))}
      <td className="min-w-0 px-2 py-2.5 align-middle sm:px-3">
        <LeadSourceCell startedFrom={lead.startedFrom} origin={lead.conversationOrigin} />
      </td>
      <td className="min-w-0 px-2 py-2.5 align-middle text-slate-700 sm:px-3">
        {locOk ? (
          <span className="line-clamp-2 text-xs leading-snug sm:text-sm" title={locLine}>
            {locLine}
          </span>
        ) : (
          <span className="text-xs text-slate-400 sm:text-sm">Not available</span>
        )}
      </td>
      <td className="min-w-0 px-2 py-2.5 align-middle sm:px-3">
        <LeadCapturedFieldsTagsCell lead={lead} fieldDefinitions={leadFieldDefinitions} />
      </td>
      <td className="min-w-0 whitespace-nowrap py-2.5 pl-2 pr-4 align-middle text-right sm:pl-3 sm:pr-5">
        <div className="inline-flex items-center justify-end gap-0.5">
          <Tooltip content="View lead details" side="top">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={actionIconBtnClass}
              aria-label="View lead details"
              onClick={() => onOpenDetail(lead.conversationId)}
            >
              <Eye size={14} strokeWidth={2} aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip content="Open conversation in insights" side="top">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={actionIconBtnClass}
              aria-label="Open conversation in insights"
              onClick={() =>
                onOpenChat(customerConversationInsightsPath(botId, lead.conversationId))
              }
            >
              <SquareArrowOutUpRight size={14} strokeWidth={2} aria-hidden />
            </Button>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}
