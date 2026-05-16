export const KB_REPLY_PRIORITY_SOURCE_TYPES = [
  'faq',
  'note',
  'table',
  'document',
  'suggestion',
] as const;

export type KnowledgeReplyPrioritySourceType = (typeof KB_REPLY_PRIORITY_SOURCE_TYPES)[number];
export type KnowledgeReplyPriorityMode = 'default' | 'priority';

export type KnowledgeReplyPrioritySettings = {
  mode: KnowledgeReplyPriorityMode;
  sourceOrder: KnowledgeReplyPrioritySourceType[];
};

export const DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS: KnowledgeReplyPrioritySettings = {
  mode: 'default',
  sourceOrder: [...KB_REPLY_PRIORITY_SOURCE_TYPES],
};

export function normalizeKnowledgeReplyPrioritySettings(
  input: unknown,
): KnowledgeReplyPrioritySettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS };
  }
  const o = input as Record<string, unknown>;
  const modeRaw = String(o.mode ?? '').trim();
  const mode: KnowledgeReplyPriorityMode = modeRaw === 'priority' ? 'priority' : 'default';
  const rawOrder = Array.isArray(o.sourceOrder) ? o.sourceOrder : [];
  const seen = new Set<KnowledgeReplyPrioritySourceType>();
  const normalized: KnowledgeReplyPrioritySourceType[] = [];
  for (const v of rawOrder) {
    const s = String(v ?? '').trim() as KnowledgeReplyPrioritySourceType;
    if (!KB_REPLY_PRIORITY_SOURCE_TYPES.includes(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    normalized.push(s);
  }
  for (const s of KB_REPLY_PRIORITY_SOURCE_TYPES) {
    if (!seen.has(s)) normalized.push(s);
  }
  return { mode, sourceOrder: normalized };
}

export function sourcePriorityRankMap(
  settings: KnowledgeReplyPrioritySettings,
): Map<string, number> {
  const m = new Map<string, number>();
  settings.sourceOrder.forEach((s, i) => m.set(s, i));
  return m;
}
