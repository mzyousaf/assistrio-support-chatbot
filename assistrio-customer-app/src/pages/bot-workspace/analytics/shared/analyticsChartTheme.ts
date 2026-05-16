/**
 * Max height (px) for {@link AnalyticsChartCard} — the whole card (header + body).
 * Chart components inside may use their own sizing; the card scrolls when content exceeds this.
 */
export const ANALYTICS_CARD_MAX_HEIGHT_PX = 400;

/**
 * Standard Recharts mount height (px). Avoid viewport-relative heights so chart blocks stay consistent
 * across screen sizes.
 */
export const ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX = 360;

/**
 * Default block height for empty chart placeholders (matches typical card body).
 */
export const ANALYTICS_CHART_BLOCK_HEIGHT_CLASS = 'h-[320px] min-h-[320px] max-h-[320px]';

/**
 * Two charts side-by-side on wide viewports; single column below `xl` (width-based stacking).
 */
export const ANALYTICS_TWO_CHART_ROW_GRID_CLASS =
  'grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch';

/**
 * Inside analytics trend cards: main chart + right rail stay on one horizontal row at all widths;
 * flex shrinks/grows the main chart while the sidebar keeps ~34% (max 24rem, min 11rem).
 */
export const ANALYTICS_SPLIT_CHART_ROW_CLASS =
  'flex min-h-0 flex-1 flex-row items-stretch gap-4 p-3 sm:gap-6 sm:p-5';

export const ANALYTICS_SPLIT_CHART_MAIN_CLASS = 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col';

export const ANALYTICS_SPLIT_SIDEBAR_34_CLASS =
  'flex min-h-0 min-w-[11rem] w-[34%] max-w-[min(100%,24rem)] shrink-0 flex-col overflow-hidden self-start border-l border-slate-200/90 pl-4 pt-0 sm:pl-6';

/** Topic trends sidebar — slightly narrower rail. */
export const ANALYTICS_SPLIT_SIDEBAR_32_CLASS =
  'flex min-h-0 min-w-[11rem] w-[32%] max-w-[min(100%,22rem)] shrink-0 flex-col overflow-hidden self-start border-l border-slate-200/90 pl-4 pt-0 sm:pl-6';

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
