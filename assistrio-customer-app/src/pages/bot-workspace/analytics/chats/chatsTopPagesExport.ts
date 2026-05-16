import type { CustomerChatsAnalyticsTopPageRow } from '@/api/types';
import { chatsTopPageTooltipPath, isChatsTopPageUnknown, sortChatsTopPageRows } from './chatsTopPages.util';

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** RFC 4180-style CSV: UTF-8 with ranked rows in default analytics order (unknown last, by chats). */
export function buildChatsTopPagesCsv(rows: CustomerChatsAnalyticsTopPageRow[]): string {
  const sorted = sortChatsTopPageRows([...rows]);
  const header = [
    'Rank',
    'Page path',
    'Page label',
    'Website origin',
    'Chats',
    'Messages',
    'Unknown page',
  ];
  const lines = [header.join(',')];
  sorted.forEach((row, i) => {
    const cells = [
      String(i + 1),
      chatsTopPageTooltipPath(row),
      row.pageLabel?.trim() ?? '',
      row.websiteOrigin?.trim() ?? '',
      String(Math.max(0, Math.trunc(row.conversations))),
      String(Math.max(0, Math.trunc(row.messages))),
      isChatsTopPageUnknown(row) ? 'Yes' : 'No',
    ].map((c) => escapeCsvCell(c));
    lines.push(cells.join(','));
  });
  return lines.join('\r\n');
}

export function downloadChatsTopPagesCsv(rows: CustomerChatsAnalyticsTopPageRow[], filename?: string): void {
  const csv = buildChatsTopPagesCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = filename ?? `top-pages-${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
