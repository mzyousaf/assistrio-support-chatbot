import { megabytesToBytes } from './plan-catalog';
import {
  botKnowledgeSizeConfigIsMissing,
  buildBotKnowledgeSizeFromEntitlements,
} from './bot-knowledge-size-from-entitlements.util';

describe('buildBotKnowledgeSizeFromEntitlements', () => {
  it('Free plan → 10 MB KB limit', () => {
    const ks = buildBotKnowledgeSizeFromEntitlements({
      planName: 'Free',
      kbStorageBytesPerBot: megabytesToBytes(10),
      maxKbStorageBytesPerBot: megabytesToBytes(40),
    });
    expect(ks.type).toBe('default');
    expect(ks.maxBytes).toBe(10 * 1024 * 1024);
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

  it('Pro plan → 25 MB KB limit', () => {
    const ks = buildBotKnowledgeSizeFromEntitlements({
      planName: 'Pro',
      kbStorageBytesPerBot: megabytesToBytes(25),
      maxKbStorageBytesPerBot: megabytesToBytes(40),
    });
    expect(ks.maxBytes).toBe(25 * 1024 * 1024);
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

  it('returns false when maxBytes is set (including legacy 50 MiB)', () => {
    expect(
      botKnowledgeSizeConfigIsMissing({
        botConfig: { knowledgeSize: { maxBytes: 50 * 1024 * 1024 } },
      }),
    ).toBe(false);
  });
});
