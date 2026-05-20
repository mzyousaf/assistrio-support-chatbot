import { useMemo, type CSSProperties } from 'react';
import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import {
  inferLeadFieldStatus,
  isLeadsTableNameFieldColumn,
  LEADS_TABLE_LEAD_IDENTITY_COL_MAX_PX,
  LEADS_TABLE_NAME_FIELD_COL_MAX_PX,
  type LeadsInboxTableColumn,
} from './leadsUiHelpers';
import { LeadsTableRow } from './LeadsTableRow';

type Props = {
  botId: string;
  leads: CustomerLeadListItem[];
  /** Full definitions (used for status / quality). */
  leadFieldDefinitions: CustomerLeadFieldDefinition[];
  /** Composite Lead + Captured At + Status + Name + Email / Phone / Company; further keys roll up under Captured Fields. */
  inboxColumns: LeadsInboxTableColumn[];
  onOpenDetail: (conversationId: string) => void;
  onOpenChat: (path: string) => void;
};

const thLabel = 'text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500';

const COL = {
  leadIdentity: 200,
  status: 120,
  captured: 170,
  field: 200,
  capturedFields: 300,
  source: 180,
  location: 180,
  actions: 96,
} as const;

function colMin(px: number): CSSProperties {
  return { minWidth: px };
}

function colFieldForDef(isNameLike: boolean): CSSProperties {
  if (!isNameLike) return colMin(COL.field);
  return {
    minWidth: COL.field,
    maxWidth: LEADS_TABLE_NAME_FIELD_COL_MAX_PX,
    width: LEADS_TABLE_NAME_FIELD_COL_MAX_PX,
  };
}

function colLeadIdentity(): CSSProperties {
  return { minWidth: COL.leadIdentity, maxWidth: LEADS_TABLE_LEAD_IDENTITY_COL_MAX_PX };
}

function partitionInboxColumns(cols: LeadsInboxTableColumn[]): {
  nameColumn: LeadsInboxTableColumn;
  fieldColumns: LeadsInboxTableColumn[];
} {
  const nameColumn =
    cols.find((c) => isLeadsTableNameFieldColumn(c.field)) ??
    cols[0] ??
    ({
      headerLabel: 'Name',
      field: {
        key: 'name',
        label: 'Name',
        type: 'text',
        required: false,
        order: 0,
        fieldStatus: 'active',
      },
    } satisfies LeadsInboxTableColumn);
  const fieldColumns = cols.filter((c) => c.field.key.trim() !== nameColumn.field.key.trim());
  return { nameColumn, fieldColumns };
}

function LeadFieldColumnHeaderBadge({ def }: { def: LeadsInboxTableColumn['field'] }) {
  const st = inferLeadFieldStatus(def);
  if (st === 'active') return null;
  const label = st === 'inactive' ? 'Inactive' : 'Deleted';
  const cls =
    st === 'inactive'
      ? 'bg-amber-100 text-amber-900 ring-amber-200/75'
      : 'bg-rose-50 text-rose-900 ring-rose-200/75';
  return (
    <span
      className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cls}`}
      aria-label={`${label} field`}
    >
      {label}
    </span>
  );
}

export function LeadsTable({
  botId,
  leads,
  leadFieldDefinitions,
  inboxColumns,
  onOpenDetail,
  onOpenChat,
}: Props) {
  const { nameColumn, fieldColumns } = useMemo(() => partitionInboxColumns(inboxColumns), [inboxColumns]);
  const nameIsNameLike = isLeadsTableNameFieldColumn(nameColumn.field);
  const fieldColWidth = fieldColumns.length * COL.field;
  const tableMinWidth = useMemo(
    () =>
      COL.leadIdentity +
      COL.field +
      COL.captured +
      COL.status +
      fieldColWidth +
      COL.source +
      COL.location +
      COL.capturedFields +
      COL.actions,
    [fieldColWidth],
  );

  return (
    <div className="w-full" aria-label="Leads list">
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]">
        <table
          className="w-full border-collapse text-left text-sm"
          style={{ minWidth: tableMinWidth }}
        >
          <colgroup>
            <col style={colLeadIdentity()} />
            <col style={colMin(COL.captured)} />
            <col style={colMin(COL.status)} />
            <col style={colFieldForDef(nameIsNameLike)} />
            {fieldColumns.map((col) => (
              <col
                key={col.field.key}
                style={colFieldForDef(isLeadsTableNameFieldColumn(col.field))}
              />
            ))}
            <col style={colMin(COL.source)} />
            <col style={colMin(COL.location)} />
            <col style={colMin(COL.capturedFields)} />
            <col style={colMin(COL.actions)} />
          </colgroup>
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th
                className={`min-w-0 py-2.5 pl-4 pr-2 text-left align-middle sm:pl-5 sm:pr-3 ${thLabel}`}
                scope="col"
                title="Best available value from captured data to identify this lead"
                style={{ maxWidth: LEADS_TABLE_LEAD_IDENTITY_COL_MAX_PX }}
              >
                Lead
              </th>
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Captured At
              </th>
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Status
              </th>
              <th
                className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`}
                scope="col"
                title={nameColumn.field.key}
                style={nameIsNameLike ? { maxWidth: LEADS_TABLE_NAME_FIELD_COL_MAX_PX } : undefined}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="block truncate">{nameColumn.headerLabel}</span>
                  <LeadFieldColumnHeaderBadge def={nameColumn.field} />
                </span>
              </th>
              {fieldColumns.map((col) => {
                const d = col.field;
                return (
                  <th
                    key={d.key}
                    className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}${
                      inferLeadFieldStatus(d) !== 'active' ? ' text-slate-400' : ''
                    }`}
                    scope="col"
                    title={d.key}
                    style={
                      isLeadsTableNameFieldColumn(d)
                        ? { maxWidth: LEADS_TABLE_NAME_FIELD_COL_MAX_PX }
                        : undefined
                    }
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="block truncate">{col.headerLabel}</span>
                      <LeadFieldColumnHeaderBadge def={d} />
                    </span>
                  </th>
                );
              })}
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Widget Channel
              </th>
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Location
              </th>
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Captured Fields
              </th>
              <th
                className={`whitespace-nowrap py-2.5 pl-2 pr-4 text-right align-middle sm:pl-3 sm:pr-5 ${thLabel}`}
                scope="col"
                title="Open lead details or conversation"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <LeadsTableRow
                key={lead.conversationId}
                botId={botId}
                lead={lead}
                leadFieldDefinitions={leadFieldDefinitions}
                nameColumn={nameColumn}
                fieldColumns={fieldColumns}
                onOpenDetail={onOpenDetail}
                onOpenChat={onOpenChat}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
