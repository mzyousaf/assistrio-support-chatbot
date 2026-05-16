import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import { formatStartedFromLabel } from '../conversations/ConversationStartedFromBadge';
import { formatLeadSourcePage, formatLeadCellValue, leadColumnHeaderLabel } from './leadsUiHelpers';

/** RFC 4180–style CSV cell: quote if needed, escape embedded quotes. */
export function escapeCsvCell(value: string): string {
  const v = String(value ?? '');
  const mustQuote = /[",\r\n]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function leadCapturedTimestamp(lead: CustomerLeadListItem): string {
  const raw = lead.leadCapturedAt ?? lead.lastActivityAt;
  if (raw == null || !String(raw).trim()) return '';
  return String(raw).trim();
}

export function buildLeadsCsvLines(
  leads: CustomerLeadListItem[],
  fieldDefinitions: CustomerLeadFieldDefinition[],
): string[] {
  const defs = [...fieldDefinitions].filter((d) => !d.disabled && String(d.key ?? '').trim()).sort((a, b) => a.order - b.order);

  const headers = [
    'Captured at',
    ...defs.map((d) => leadColumnHeaderLabel(d)),
    'Started from',
    'Country',
    'City',
    'Source page',
    'Conversation ID',
  ].map(escapeCsvCell);

  const lines: string[] = [headers.join(',')];

  for (const lead of leads) {
    const capturedIso = leadCapturedTimestamp(lead);
    const dynamic = defs.map((d) => escapeCsvCell(formatLeadCellValue(lead.capturedLeadData, d.key)));
    const started = formatStartedFromLabel(lead.startedFrom ?? undefined) || (lead.startedFrom ?? '').trim();
    const country = (lead.location?.country ?? lead.location?.countryCode ?? '').trim();
    const city = (lead.location?.city ?? '').trim();
    const source = formatLeadSourcePage(lead.conversationOrigin);
    const convId = (lead.conversationId ?? '').trim();

    const row = [
      escapeCsvCell(capturedIso),
      ...dynamic,
      escapeCsvCell(started),
      escapeCsvCell(country),
      escapeCsvCell(city),
      escapeCsvCell(source === '—' ? '' : source),
      escapeCsvCell(convId),
    ];
    lines.push(row.join(','));
  }

  return lines;
}

export function downloadLeadsCsv(filename: string, csvText: string): void {
  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

export function leadsExportFilenameDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `assistrio-leads-${y}-${m}-${day}.csv`;
}
