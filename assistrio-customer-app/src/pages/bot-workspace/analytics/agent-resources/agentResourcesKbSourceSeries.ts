import type { CustomerKnowledgeSourcesAnalyticsSourceType } from '@/api/types';
import { CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';

/**
 * Sources shown in KB “Source usage over time” stacked bars + sidebar “Source ranking by citations”.
 * Omits {@link CustomerKnowledgeSourcesAnalyticsSourceType unknown};
 * excludes website and manual text from this view intentionally.
 */
export const KB_SOURCE_DISPLAY_ORDER: Exclude<CustomerKnowledgeSourcesAnalyticsSourceType, 'unknown'>[] = [
  'document',
  'faq',
  'note',
  'datasheet',
  'suggestion',
];

export const KB_SOURCE_LABEL: Record<CustomerKnowledgeSourcesAnalyticsSourceType, string> = {
  document: 'Document',
  faq: 'FAQ',
  /** Snippets in the KB product map to persisted source type {@link CustomerKnowledgeSourcesAnalyticsSourceType `note`}. */
  note: 'Snippets',
  datasheet: 'Datasheet',
  website: 'Website',
  suggestion: 'Suggestion',
  manual_text: 'Manual text',
  unknown: 'Unknown',
};

export const KB_SOURCE_COLOR: Record<CustomerKnowledgeSourcesAnalyticsSourceType, string> = {
  document: CHART.kbSourceStackDocument,
  faq: CHART.kbSourceStackFaq,
  note: CHART.kbSourceStackNote,
  datasheet: CHART.kbSourceStackDatasheet,
  website: CHART.rose400,
  suggestion: CHART.kbSourceStackSuggestion,
  manual_text: CHART.leadPartialOrange,
  unknown: CHART.slate400,
};
