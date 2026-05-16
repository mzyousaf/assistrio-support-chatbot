/**
 * Default per-rule credit knobs: unit price + whether that line contributes to message `creditCost` totals.
 *
 * Amounts (`credits`): composite billing stacks count × these values where both `rule.enabled`
 * on the assembled rule AND `includeInTotalCredits` are true.
 *
 * `includeInTotalCredits: false`: still surfaced in fingerprints / rule config where applicable,
 * but that component’s billed credits resolve to **0** (see {@link calculateMessageCreditUsage}).
 * Fractional `credits` are supported when included in totals.
 */
export const MESSAGE_CREDIT_UNIT_CONFIG = {
  text_message: { credits: 1, includeInTotalCredits: true },
  suggested_question_message: { credits: 1, includeInTotalCredits: true },
  quick_reply_message: { credits: 1, includeInTotalCredits: false },
  voice_message: { credits: 2, includeInTotalCredits: true },
  /** Per Whisper/browser dictation session merged into composer before send */
  dictation_session: { credits: 0.25, includeInTotalCredits: true },
  attachment_message: { credits: 1, includeInTotalCredits: false },
  unknown_message: { credits: 1, includeInTotalCredits: false },
} as const;

export type MessageCreditUnitPriceKey = keyof typeof MESSAGE_CREDIT_UNIT_CONFIG;

/** Only the numeric weights — tweak prices in {@link MESSAGE_CREDIT_UNIT_CONFIG} instead when possible. */
export const MESSAGE_CREDIT_UNIT_PRICES: {
  readonly [K in MessageCreditUnitPriceKey]: number;
} = {
  text_message: MESSAGE_CREDIT_UNIT_CONFIG.text_message.credits,
  suggested_question_message: MESSAGE_CREDIT_UNIT_CONFIG.suggested_question_message.credits,
  quick_reply_message: MESSAGE_CREDIT_UNIT_CONFIG.quick_reply_message.credits,
  voice_message: MESSAGE_CREDIT_UNIT_CONFIG.voice_message.credits,
  dictation_session: MESSAGE_CREDIT_UNIT_CONFIG.dictation_session.credits,
  attachment_message: MESSAGE_CREDIT_UNIT_CONFIG.attachment_message.credits,
  unknown_message: MESSAGE_CREDIT_UNIT_CONFIG.unknown_message.credits,
};
