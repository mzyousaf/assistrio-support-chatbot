import { megabytesToBytes } from './plan-catalog';
import {
  botKnowledgeSizeConfigIsMissing,
  buildBotKnowledgeSizeFromEntitlements,
  botKnowledgeSizeUsesLegacySchemaDefault,
  shouldResolveKnowledgeSizeFromWorkspaceEntitlements,
} from './bot-knowledge-size-from-entitlements.util';
import { DEFAULT_BOT_KNOWLEDGE_SIZE } from '../knowledge/knowledge-plan-limits';

describe('buildBotKnowledgeSizeFromEntitlements', () => {
  it('Free plan → 5 MB KB limit', () => {
    const ks = buildBotKnowledgeSizeFromEntitlements({
      planName: 'Free',
      kbStorageBytesPerBot: megabytesToBytes(5),
      maxKbStorageBytesPerBot: megabytesToBytes(40),
    });
    expect(ks.type).toBe('default');
    expect(ks.maxBytes).toBe(5 * 1024 * 1024);
    expect(ks.baseMaxBytes).toBe(ks.maxBytes);
    expect(ks.extraMaxBytes).toBe(0);
    expect(ks.note).toBe('Free plan');
  });

  it('Starter plan → 15 MB KB limit', () => {
    const ks = buildBotKnowledgeSizeFromEntitlements({
      planName: 'Starter',
      kbStorageBytesPerBot: megabytesToBytes(15),
      maxKbStorageBytesPerBot: megabytesToBytes(40),
    });
    expect(ks.maxBytes).toBe(15 * 1024 * 1024);
    expect(ks.note).toBe('Starter plan');
  });

  it('Pro plan → 30 MB KB limit', () => {
    const ks = buildBotKnowledgeSizeFromEntitlements({
      planName: 'Pro',
      kbStorageBytesPerBot: megabytesToBytes(30),
      maxKbStorageBytesPerBot: megabytesToBytes(40),
    });
    expect(ks.maxBytes).toBe(30 * 1024 * 1024);
    expect(ks.note).toBe('Pro plan');
  });

  it('never exceeds maxKbStorageBytesPerBot cap (40 MB)', () => {
    const ks = buildBotKnowledgeSizeFromEntitlements({
      planName: 'Hypothetical',
      kbStorageBytesPerBot: megabytesToBytes(50),
      maxKbStorageBytesPerBot: megabytesToBytes(40),
    });
    expect(ks.maxBytes).toBe(40 * 1024 * 1024);
    expect(ks.baseMaxBytes).toBe(40 * 1024 * 1024);
  });
});

describe('botKnowledgeSizeConfigIsMissing', () => {
  it('returns true when botConfig.knowledgeSize is absent', () => {
    expect(botKnowledgeSizeConfigIsMissing({})).toBe(true);
    expect(botKnowledgeSizeConfigIsMissing({ botConfig: {} })).toBe(true);
  });

  it('returns false when maxBytes is set with plan note (including explicit 50 MiB)', () => {
    expect(
      botKnowledgeSizeConfigIsMissing({
        botConfig: { knowledgeSize: { maxBytes: 50 * 1024 * 1024, note: 'Pro plan' } },
      }),
    ).toBe(false);
  });
});

describe('botKnowledgeSizeUsesLegacySchemaDefault', () => {
  it('detects mongoose 50 MiB default without plan note', () => {
    expect(
      botKnowledgeSizeUsesLegacySchemaDefault({
        botConfig: { knowledgeSize: { maxBytes: DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes, note: null } },
      }),
    ).toBe(true);
  });

  it('ignores plan-derived 50 MiB cap with note', () => {
    expect(
      botKnowledgeSizeUsesLegacySchemaDefault({
        botConfig: { knowledgeSize: { maxBytes: DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes, note: 'Hypothetical plan' } },
      }),
    ).toBe(false);
  });
});

describe('shouldResolveKnowledgeSizeFromWorkspaceEntitlements', () => {
  it('is true when knowledgeSize is missing', () => {
    expect(shouldResolveKnowledgeSizeFromWorkspaceEntitlements({ botConfig: {} })).toBe(true);
  });

  it('is true for legacy schema default on workspace bots', () => {
    expect(
      shouldResolveKnowledgeSizeFromWorkspaceEntitlements({
        botConfig: { knowledgeSize: { maxBytes: DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes } },
      }),
    ).toBe(true);
  });

  it('is false for explicit plan-derived quota', () => {
    expect(
      shouldResolveKnowledgeSizeFromWorkspaceEntitlements({
        botConfig: { knowledgeSize: { maxBytes: 15 * 1024 * 1024, note: 'Starter plan' } },
      }),
    ).toBe(false);
  });
});
