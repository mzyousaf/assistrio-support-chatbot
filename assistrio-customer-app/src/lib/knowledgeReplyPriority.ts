import type { KnowledgeReplyPrioritySettings, KnowledgeReplyPrioritySourceType } from '@/api/types';

export const DEFAULT_KNOWLEDGE_REPLY_PRIORITY: KnowledgeReplyPrioritySettings = {
  mode: 'default',
  sourceOrder: ['faq', 'note', 'table', 'document', 'suggestion'],
};

export function normalizeKnowledgeReplyPriority(
  input: Partial<KnowledgeReplyPrioritySettings> | null | undefined,
): KnowledgeReplyPrioritySettings {
  const mode = input?.mode === 'priority' ? 'priority' : 'default';
  const seen = new Set<KnowledgeReplyPrioritySourceType>();
  const order: KnowledgeReplyPrioritySourceType[] = [];
  for (const v of input?.sourceOrder ?? []) {
    if (
      (v === 'faq' || v === 'note' || v === 'table' || v === 'document' || v === 'suggestion') &&
      !seen.has(v)
    ) {
      seen.add(v);
      order.push(v);
    }
  }
  for (const v of DEFAULT_KNOWLEDGE_REPLY_PRIORITY.sourceOrder) {
    if (!seen.has(v)) order.push(v);
  }
  return { mode, sourceOrder: order };
}

export function movePrioritySource(
  order: KnowledgeReplyPrioritySourceType[],
  index: number,
  dir: -1 | 1,
): KnowledgeReplyPrioritySourceType[] {
  const target = index + dir;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) {
    return [...order];
  }
  const out = [...order];
  const tmp = out[index];
  out[index] = out[target];
  out[target] = tmp;
  return out;
}
