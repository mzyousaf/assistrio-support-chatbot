/**
 * Max height (px) for {@link AnalyticsChartCard} — the whole card (header + body).
 * Chart components inside may use their own sizing; the card scrolls when content exceeds this.
 */
export const ANALYTICS_CARD_MAX_HEIGHT_PX = 400;

/** Recharts palette — teal primary, muted secondaries (Assistrio analytics, light SaaS). */
export const CHART = {
  teal600: '#0d9488',
  teal700: '#0f766e',
  /** Leads analytics — complete-lead areas (green-600). */
  leadCompleteGreen: '#16a34a',
  /** Leads analytics — partial-lead areas (orange-600). */
  leadPartialOrange: '#ea580c',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  indigo400: '#818cf8',
  amber500: '#f59e0b',
  rose400: '#fb7185',
  /**
   * Credit Usage stacked bars — blue → violet → warm coral; hues sit away from the teal total area.
   */
  usageCreditStackText: '#5278d9',
  usageCreditStackVoice: '#8f74d8',
  usageCreditStackDictation: '#e89563',
  /**
   * KB “Source usage over time” stacked bars — five categorical hues spaced off the teal trend.
   */
  kbSourceStackDocument: '#5278d9',
  kbSourceStackFaq: '#8f74d8',
  kbSourceStackNote: '#c765a9',
  kbSourceStackDatasheet: '#e89563',
  kbSourceStackSuggestion: '#d9a23c',
  grid: '#e2e8f0',
  axis: '#64748b',
  tooltipBorder: '#e2e8f0',
  tooltipShadow: '0 8px 24px rgba(15,23,42,0.08)',
} as const;
