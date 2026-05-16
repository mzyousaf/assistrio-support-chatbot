/**
 * Max height (px) for {@link AnalyticsChartCard} — the whole card (header + body).
 * Chart components inside may use their own sizing; the card scrolls when content exceeds this.
 */
export const ANALYTICS_CARD_MAX_HEIGHT_PX = 400;

/** Recharts palette — teal primary, muted secondaries (Assistrio analytics, light SaaS). */
export const CHART = {
  teal600: '#0d9488',
  teal700: '#0f766e',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  indigo400: '#818cf8',
  amber500: '#f59e0b',
  rose400: '#fb7185',
  grid: '#e2e8f0',
  axis: '#64748b',
  tooltipBorder: '#e2e8f0',
  tooltipShadow: '0 8px 24px rgba(15,23,42,0.08)',
} as const;
