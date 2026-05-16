import { useMemo, type CSSProperties } from 'react';
import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import {
  isLeadsTableNameFieldColumn,
  leadColumnHeaderLabel,
  LEADS_TABLE_LEAD_COL_MAX_PX,
  LEADS_TABLE_NAME_FIELD_COL_MAX_PX,
} from './leadsUiHelpers';
import { LeadsTableRow } from './LeadsTableRow';

type Props = {
  botId: string;
  leads: CustomerLeadListItem[];
  columnDefs: CustomerLeadFieldDefinition[];
  onOpenDetail: (conversationId: string) => void;
  onOpenChat: (path: string) => void;
};

const thLabel = 'text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500';

/** Minimum column widths (px): compact cols stay narrow; text-heavy cols get more room. */
const COL = {
  lead: 150,
  status: 120,
  captured: 170,
  field: 200,
  source: 180,
  location: 180,
  actions: 96,
} as const;

function colMin(px: number): CSSProperties {
  return { minWidth: px };
}

function colField(d: CustomerLeadFieldDefinition): CSSProperties {
  if (!isLeadsTableNameFieldColumn(d)) return colMin(COL.field);
  return {
    minWidth: COL.field,
    maxWidth: LEADS_TABLE_NAME_FIELD_COL_MAX_PX,
    width: LEADS_TABLE_NAME_FIELD_COL_MAX_PX,
  };
}

/** Lead column: don’t grow past max width so other columns get room on wide viewports. */
function colLead(): CSSProperties {
  return { minWidth: COL.lead, maxWidth: LEADS_TABLE_LEAD_COL_MAX_PX };
}

export function LeadsTable({ botId, leads, columnDefs, onOpenDetail, onOpenChat }: Props) {
  const tableMinWidth = useMemo(() => {
    const fieldCols = columnDefs.length * COL.field;
    return (
      COL.lead + COL.status + COL.captured + fieldCols + COL.source + COL.location + COL.actions
    );
  }, [columnDefs.length]);

  return (
    <div className="w-full" aria-label="Leads list">
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]">
        <table
          className="w-full border-collapse text-left text-sm"
          style={{ minWidth: tableMinWidth }}
        >
          <colgroup>
            {columnDefs.length === 0 ? (
              <>
                <col style={colLead()} />
                <col style={colMin(COL.status)} />
                <col style={colMin(COL.captured)} />
                <col style={colMin(COL.source)} />
                <col style={colMin(COL.location)} />
                <col style={colMin(COL.actions)} />
              </>
            ) : (
              <>
                <col style={colLead()} />
                <col style={colMin(COL.status)} />
                <col style={colMin(COL.captured)} />
                {columnDefs.map((d) => (
                  <col key={d.key} style={colField(d)} />
                ))}
                <col style={colMin(COL.source)} />
                <col style={colMin(COL.location)} />
                <col style={colMin(COL.actions)} />
              </>
            )}
          </colgroup>
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th
                className={`min-w-0 py-2.5 pl-4 pr-2 text-left align-middle sm:pl-5 sm:pr-3 ${thLabel}`}
                scope="col"
                style={{ maxWidth: LEADS_TABLE_LEAD_COL_MAX_PX }}
              >
                Lead
              </th>
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Status
              </th>
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Captured
              </th>
              {columnDefs.map((d) => (
                <th
                  key={d.key}
                  className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`}
                  scope="col"
                  title={d.key}
                  style={
                    isLeadsTableNameFieldColumn(d)
                      ? { maxWidth: LEADS_TABLE_NAME_FIELD_COL_MAX_PX }
                      : undefined
                  }
                >
                  <span className="block truncate">{leadColumnHeaderLabel(d)}</span>
                </th>
              ))}
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Source
              </th>
              <th className={`min-w-0 px-2 py-2.5 text-left align-middle sm:px-3 ${thLabel}`} scope="col">
                Location
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
                columnDefs={columnDefs}
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
