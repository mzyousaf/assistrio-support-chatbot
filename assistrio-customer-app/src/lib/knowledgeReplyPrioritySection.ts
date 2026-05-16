import type { KnowledgeReplyPrioritySourceType } from '@/api/types';

export const REPLY_PRIORITY_SECTION_COPY = {
  title: 'Reply source priority',
  description:
    'Choose how Assistrio picks from your knowledge when more than one source can answer.',
  defaultTitle: 'Default ranking',
  defaultTag: 'Recommended',
  defaultBody: 'Assistrio picks the best matching answer automatically.',
  priorityTitle: 'Prioritized ranking',
  priorityTag: 'Custom order',
  priorityBody: 'Use your order when matches are close.',
  defaultModeNote: 'Your custom order is saved, but only used in Prioritized ranking.',
  prioritizedModeNote: 'Drag sources to set which ones Assistrio should prefer first.',
} as const;

export const REPLY_PRIORITY_SOURCE_META: Array<{
  key: KnowledgeReplyPrioritySourceType;
  label: string;
  description: string;
}> = [
  { key: 'faq', label: 'FAQ', description: 'Best for direct questions and approved answers.' },
  { key: 'note', label: 'Snippet', description: 'Best for short, reusable guidance.' },
  { key: 'table', label: 'Datasheet', description: 'Best for structured rows, database snapshots, pricing, inventory, or records.' },
  { key: 'document', label: 'Document', description: 'Best for policies, PDFs, uploaded files, and long-form content.' },
  { key: 'suggestion', label: 'Suggestion', description: 'Best for guided example-question knowledge.' },
];

export function reorderPriorityByDrop(
  order: KnowledgeReplyPrioritySourceType[],
  fromIndex: number,
  toIndex: number,
): KnowledgeReplyPrioritySourceType[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length ||
    fromIndex === toIndex
  ) {
    return [...order];
  }
  const next = [...order];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
