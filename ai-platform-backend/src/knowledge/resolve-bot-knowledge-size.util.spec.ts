import { DEFAULT_BOT_KNOWLEDGE_SIZE } from './knowledge-plan-limits';
import { resolveBotKnowledgeSizeConfig } from './resolve-bot-knowledge-size.util';

describe('resolveBotKnowledgeSizeConfig', () => {
  it('returns defaults when botConfig.knowledgeSize is missing', () => {
    expect(resolveBotKnowledgeSizeConfig(null)).toEqual({
      type: DEFAULT_BOT_KNOWLEDGE_SIZE.type,
      baseMaxBytes: DEFAULT_BOT_KNOWLEDGE_SIZE.baseMaxBytes,
      extraMaxBytes: DEFAULT_BOT_KNOWLEDGE_SIZE.extraMaxBytes,
      maxBytes: DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes,
      lastPaidAt: null,
      expiresAt: null,
    });
    expect(resolveBotKnowledgeSizeConfig({})).toEqual(resolveBotKnowledgeSizeConfig(null));
    expect(resolveBotKnowledgeSizeConfig({ botConfig: {} })).toEqual(resolveBotKnowledgeSizeConfig(null));
  });

  it('returns configured limits for valid paid_addon', () => {
    const lastPaid = new Date('2024-06-01T00:00:00.000Z');
    const expires = new Date('2025-06-01T00:00:00.000Z');
    const maxBytes = 150 * 1024 * 1024;
    expect(
      resolveBotKnowledgeSizeConfig({
        botConfig: {
          knowledgeSize: {
            type: 'paid_addon',
            baseMaxBytes: 50 * 1024 * 1024,
            extraMaxBytes: 100 * 1024 * 1024,
            maxBytes,
            lastPaidAt: lastPaid,
            expiresAt: expires,
          },
        },
      }),
    ).toEqual({
      type: 'paid_addon',
      baseMaxBytes: 50 * 1024 * 1024,
      extraMaxBytes: 100 * 1024 * 1024,
      maxBytes,
      lastPaidAt: lastPaid,
      expiresAt: expires,
    });
  });

  it('falls back to defaults when maxBytes is missing or invalid', () => {
    expect(
      resolveBotKnowledgeSizeConfig({
        botConfig: { knowledgeSize: { type: 'custom' } as { type: 'custom'; maxBytes?: number } },
      }),
    ).toEqual(resolveBotKnowledgeSizeConfig(null));
    expect(
      resolveBotKnowledgeSizeConfig({
        botConfig: { knowledgeSize: { type: 'paid_addon', maxBytes: NaN } },
      }),
    ).toEqual(resolveBotKnowledgeSizeConfig(null));
    expect(
      resolveBotKnowledgeSizeConfig({
        botConfig: { knowledgeSize: { type: 'paid_addon', maxBytes: 0 } },
      }),
    ).toEqual(resolveBotKnowledgeSizeConfig(null));
  });
});
