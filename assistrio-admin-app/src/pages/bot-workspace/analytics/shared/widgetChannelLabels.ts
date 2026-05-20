import type { AdminChatsAnalyticsStartedFromKey } from '@/api/types';

/** Customer-facing label for each analytics `startedFrom` / widget channel key. */
export const WIDGET_CHANNEL_LABELS: Record<AdminChatsAnalyticsStartedFromKey, string> = {
  playground_preview: 'Playground Preview',
  shared_preview: 'Shared Widget',
  runtime_widget: 'Chat Widget',
  runtime_iframe: 'Iframe',
  unknown: 'Unknown',
};

export const WIDGET_CHANNEL_FIELD_LABEL = 'Widget Channel';

export const WIDGET_CHANNEL_SECTIONS: {
  title: string;
  options: { id: AdminChatsAnalyticsStartedFromKey; label: string }[];
}[] = [
  {
    title: 'Live',
    options: [
      { id: 'runtime_widget', label: WIDGET_CHANNEL_LABELS.runtime_widget },
      { id: 'runtime_iframe', label: WIDGET_CHANNEL_LABELS.runtime_iframe },
    ],
  },
  {
    title: 'Preview',
    options: [
      { id: 'playground_preview', label: WIDGET_CHANNEL_LABELS.playground_preview },
      { id: 'shared_preview', label: WIDGET_CHANNEL_LABELS.shared_preview },
    ],
  },
];

const WIDGET_CHANNEL_LABEL_SET = new Set<string>(Object.keys(WIDGET_CHANNEL_LABELS));

export function isWidgetChannelKey(id: string): id is AdminChatsAnalyticsStartedFromKey {
  return WIDGET_CHANNEL_LABEL_SET.has(id);
}

/** Readable widget channel name for filters, tables, badges, and insights. */
export function widgetStartedFromUiLabel(id: AdminChatsAnalyticsStartedFromKey | string): string {
  const key = String(id ?? '').trim();
  if (isWidgetChannelKey(key)) return WIDGET_CHANNEL_LABELS[key];
  if (!key) return WIDGET_CHANNEL_LABELS.unknown;
  return key.replace(/_/g, ' ');
}
