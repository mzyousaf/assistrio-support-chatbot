import { APEX } from './apexAnalyticsTheme';

/** Inline style object for legacy HTML tooltips (matches previous Recharts box). */
export const analyticsTooltipBoxStyle = {
  border: `1px solid ${APEX.tooltipBorder}`,
  borderRadius: 8,
  fontSize: 12,
  boxShadow: APEX.tooltipShadow,
} as const;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Floating tooltip shell (HTML string for Apex `tooltip.custom`). */
export function apexTooltipShell(title: string, bodyRowsHtml: string): string {
  const t = escapeHtml(title);
  return `<div style="padding:10px 12px;background:#fff;border:1px solid ${APEX.tooltipBorder};border-radius:10px;box-shadow:${APEX.tooltipShadow};min-width:10rem;font-family:inherit;font-size:12px"><div style="font-weight:600;color:#334155;margin-bottom:4px">${t}</div>${bodyRowsHtml}</div>`;
}

export function apexTooltipRow(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:18px;margin:3px 0"><span style="color:#64748b">${escapeHtml(label)}</span><span style="font-variant-numeric:tabular-nums;font-weight:600;color:#0f172a">${escapeHtml(value)}</span></div>`;
}
