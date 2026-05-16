import { CHAT_MESSAGE_CREDIT_RULES, CHAT_MESSAGE_CREDIT_RULE_VERSION } from './chat-credit-rules.constant';
import {
  buildChatCreditRuleFingerprint,
  calculateMessageCreditUsage,
  resolvedDictationSessionCount,
  resolveLedgerPrimaryUsageType,
  resolveMessageCreditRuleKey,
} from './message-credit.util';

describe('resolveMessageCreditRuleKey / resolveLedgerPrimaryUsageType', () => {
  it('prefers voiceMeta.isVoiceMessage over inputType text', () => {
    expect(
      resolveMessageCreditRuleKey({
        inputType: 'text',
        voiceMeta: { isVoiceMessage: true },
      }),
    ).toBe('voice_message');

    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'text',
        voiceMeta: { isVoiceMessage: true },
      }),
    ).toBe('voice_message');
  });

  it('routes dictation paths to ledger dictation bucket', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'text',
        voiceMeta: { isDictationMessage: true },
      }),
    ).toBe('dictation_message');
  });

  it('voice wins when both flags true', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        voiceMeta: { isVoiceMessage: true, isDictationMessage: true },
      }),
    ).toBe('voice_message');
  });

  it('maps browser_speech_recognition to dictation bucket', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'text',
        inputMethod: 'browser_speech_recognition',
        voiceMeta: { isDictationMessage: true },
      }),
    ).toBe('dictation_message');

    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'text',
        inputMethod: 'browser_speech_recognition',
      }),
    ).toBe('dictation_message');
  });

  it('maps microphone_transcription to dictation bucket', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'dictation',
        inputMethod: 'microphone_transcription',
        voiceMeta: { isDictationMessage: true, transcriptionProvider: 'whisper' },
      }),
    ).toBe('dictation_message');

    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'text',
        inputMethod: 'microphone_transcription',
      }),
    ).toBe('dictation_message');
  });

  it('text beats attachment classification when attachments are present', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'text',
        hasAttachments: true,
      }),
    ).toBe('text_message');
  });

  it('non-empty text beats attachment-only even if inputType is attachment', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'attachment',
        hasAttachments: true,
        hasTextContent: true,
      }),
    ).toBe('text_message');
  });

  it('attachments without text classify as attachment_message', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        inputType: 'attachment',
        hasAttachments: true,
        hasTextContent: false,
      }),
    ).toBe('attachment_message');
  });

  it('bare hasAttachments without text is attachment-only', () => {
    expect(
      resolveLedgerPrimaryUsageType({
        hasAttachments: true,
        hasTextContent: false,
      }),
    ).toBe('attachment_message');
  });
});

describe('calculateMessageCreditUsage', () => {
  it('text + attachment => text + attachment rows; usageType text', () => {
    const r = calculateMessageCreditUsage({ inputType: 'text', hasAttachments: true, hasTextContent: true });
    expect(r.usageType).toBe('text_message');
    expect(r.creditsUsed).toBe(1);
    expect(r.breakdown.some((x) => x.key === 'text_message' && x.creditsUsed === 1)).toBe(true);
    expect(r.breakdown.some((x) => x.key === 'attachment_message' && x.billable === false && x.creditsUsed === 0)).toBe(true);
  });

  it('voice + attachment => voice credits only (+ attachment disclosure)', () => {
    const r = calculateMessageCreditUsage({ inputType: 'voice', hasAttachments: true });
    expect(r.usageType).toBe('voice_message');
    expect(r.creditsUsed).toBe(2);
    expect(r.breakdown.some((x) => x.key === 'voice_message')).toBe(true);
  });

  it('dictation with 1 session => text + dictation (+ attachment disclosure)', () => {
    const r = calculateMessageCreditUsage({
      inputType: 'dictation',
      voiceMeta: { isDictationMessage: true, dictationSessionCount: 1 },
      hasAttachments: false,
      hasTextContent: true,
    });
    expect(r.usageType).toBe('dictation_message');
    expect(r.creditsUsed).toBe(1.25);
    expect(r.creditReason).toBe('composite:dictation_session+text_message');
    const sumRows = r.breakdown.reduce((a, b) => a + b.creditsUsed, 0);
    expect(sumRows).toBe(r.creditsUsed);
  });

  it('dictation with 2 sessions => text + 2 times dictation', () => {
    const r = calculateMessageCreditUsage({
      inputType: 'dictation',
      voiceMeta: { isDictationMessage: true, dictationSessionCount: 2 },
      hasTextContent: true,
    });
    expect(r.creditsUsed).toBe(1.5);
    const dict = r.breakdown.find((x) => x.key === 'dictation_session');
    expect(dict?.count).toBe(2);
    expect(dict?.creditsUsed).toBe(0.5);
  });

  it('dictation missing count defaults to 1 session', () => {
    const r = calculateMessageCreditUsage({
      inputType: 'dictation',
      voiceMeta: { isDictationMessage: true },
      hasTextContent: true,
    });
    const dict = r.breakdown.find((x) => x.key === 'dictation_session');
    expect(dict?.count).toBe(1);
    expect(dict?.creditsUsed).toBe(0.25);
  });

  it('typed text without dictation => text component only', () => {
    const r = calculateMessageCreditUsage({ inputType: 'text', hasTextContent: true });
    expect(r.breakdown.length).toBe(1);
    expect(r.breakdown[0]?.key).toBe('text_message');
    expect(r.creditsUsed).toBe(1);
  });

  it('resolvedDictationSessionCount does not invent sessions when not dictation', () => {
    expect(resolvedDictationSessionCount(false, { dictationSessionCount: 5 })).toBe(0);
  });

  it('attachment-only => attachment disclosure,  credits when attachment rule disabled', () => {
    const r = calculateMessageCreditUsage({ inputType: 'attachment', hasAttachments: true, hasTextContent: false });
    expect(r.usageType).toBe('attachment_message');
    expect(r.creditsUsed).toBe(0);
    expect(r.billable).toBe(false);
    expect(r.creditReason).toBe('attachment_message_not_billable');
  });

  it('voice => voice component only', () => {
    const r = calculateMessageCreditUsage({ inputType: 'voice', hasAttachments: false });
    expect(r.breakdown.map((x) => x.key)).toEqual(['voice_message']);
    expect(r.creditsUsed).toBe(2);
  });

  it('suggested_question => suggested_question_message', () => {
    const r = calculateMessageCreditUsage({ inputType: 'suggested_question', hasTextContent: true });
    expect(r.breakdown.some((x) => x.key === 'suggested_question_message')).toBe(true);
    expect(r.creditsUsed).toBe(1);
  });

  it('decimal credits sum correctly in breakdown totals', () => {
    const rules = {
      ...CHAT_MESSAGE_CREDIT_RULES,
      text_message: { ...CHAT_MESSAGE_CREDIT_RULES.text_message, credits: 0.25 },
      dictation_session: { ...CHAT_MESSAGE_CREDIT_RULES.dictation_session, credits: 0.5 },
    };
    const r = calculateMessageCreditUsage(
      { inputType: 'dictation', voiceMeta: { isDictationMessage: true, dictationSessionCount: 2 }, hasTextContent: true },
      rules,
    );
    expect(r.creditsUsed).toBeCloseTo(1.25, 5);
    const sumRows = r.breakdown.reduce((a, b) => a + b.creditsUsed, 0);
    expect(sumRows).toBeCloseTo(r.creditsUsed, 5);
  });

  it('creditBreakdown total equals creditCost field', () => {
    const r = calculateMessageCreditUsage({
      inputType: 'dictation',
      voiceMeta: { isDictationMessage: true, dictationSessionCount: 1 },
      hasTextContent: true,
    });
    expect(r.breakdown.reduce((a, b) => a + b.creditsUsed, 0)).toBe(r.creditsUsed);
  });

  it('quick_reply supported', () => {
    const r = calculateMessageCreditUsage({ inputType: 'quick_reply' });
    expect(r.usageType).toBe('quick_reply_message');
    expect(r.creditsUsed).toBe(0);
  });

  it('standalone attachment bucket keys => only attachment row when disabled rules', () => {
    const r = calculateMessageCreditUsage({ inputType: 'attachment', hasAttachments: false, hasTextContent: false });
    expect(r.breakdown.every((x) => x.key === 'attachment_message')).toBe(true);
  });

  it('disabled text rule yields billed dictation totals only', () => {
    const rules = {
      ...CHAT_MESSAGE_CREDIT_RULES,
      text_message: { ...CHAT_MESSAGE_CREDIT_RULES.text_message, enabled: false, credits: 5 },
      dictation_session: { ...CHAT_MESSAGE_CREDIT_RULES.dictation_session, credits: 2 },
    };
    const r = calculateMessageCreditUsage(
      {
        inputType: 'dictation',
        voiceMeta: { isDictationMessage: true, dictationSessionCount: 1 },
        hasTextContent: true,
      },
      rules,
    );
    expect(r.breakdown.find((x) => x.key === 'text_message')?.creditsUsed).toBe(0);
    expect(r.creditsUsed).toBe(2);
  });

  it('text => fingerprint version present', () => {
    const r = calculateMessageCreditUsage({ inputType: 'text' });
    expect(r.billingType).toBe('message_credit');
    expect(r.creditRuleVersion).toBe(CHAT_MESSAGE_CREDIT_RULE_VERSION);
  });

  it('fractional text credits via rules override', () => {
    const rules = {
      ...CHAT_MESSAGE_CREDIT_RULES,
      text_message: { ...CHAT_MESSAGE_CREDIT_RULES.text_message, credits: 1.25 },
    };
    const r = calculateMessageCreditUsage({ inputType: 'text' }, rules);
    expect(r.creditsUsed).toBe(1.25);
    expect(r.configuredCredits).toBe(1.25);
  });

  it('missing inputType resolves unknown ledger path', () => {
    const r = calculateMessageCreditUsage({});
    expect(r.usageType).toBe('unknown_message');
    expect(r.creditsUsed).toBe(0);
  });

  it('exclude component from totals keeps composite creditReason but charges only included lines', () => {
    const rules = {
      ...CHAT_MESSAGE_CREDIT_RULES,
      dictation_session: { ...CHAT_MESSAGE_CREDIT_RULES.dictation_session, includeInTotalCredits: false },
    };
    const r = calculateMessageCreditUsage(
      {
        inputType: 'dictation',
        voiceMeta: { isDictationMessage: true, dictationSessionCount: 1 },
        hasTextContent: true,
      },
      rules,
    );
    expect(r.creditsUsed).toBe(1);
    expect(r.creditReason).toBe('composite:dictation_session+text_message');
    expect(r.breakdown.find((x) => x.key === 'dictation_session')?.creditsUsed).toBe(0);
    expect(r.breakdown.find((x) => x.key === 'dictation_session')?.billable).toBe(false);
    expect(r.breakdown.find((x) => x.key === 'text_message')?.creditsUsed).toBe(1);
  });
});

describe('buildChatCreditRuleFingerprint', () => {
  it('includes version and disabled markers', () => {
    const s = buildChatCreditRuleFingerprint();
    expect(s.startsWith(`${CHAT_MESSAGE_CREDIT_RULE_VERSION}:`)).toBe(true);
    expect(s).toContain('attachment=disabled');
    expect(s).toContain('dict_session');
  });
});
