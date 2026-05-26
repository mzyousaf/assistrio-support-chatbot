import { describe, expect, it } from 'vitest';
import { kbPlanLimitClientDescription } from '@/lib/knowledgeContentUtf8Limits';
import { TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';

describe('kbPlanLimitClientDescription', () => {
  it('uses trained knowledge storage wording for plan_limit_bot_kb_total', () => {
    const msg = kbPlanLimitClientDescription('plan_limit_bot_kb_total', '', {
      errorCode: 'plan_limit_bot_kb_total',
      currentBytes: 5 * 1024 * 1024,
      maxBytes: 5 * 1024 * 1024,
    });
    expect(msg).toContain('trained knowledge storage limit');
    expect(msg).toContain(`${TRAINED_KNOWLEDGE_STORAGE_LABEL}: 5.00 MB / 5.00 MB`);
  });
});
