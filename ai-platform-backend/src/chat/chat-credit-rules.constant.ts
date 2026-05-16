import { MESSAGE_CREDIT_UNIT_CONFIG, MESSAGE_CREDIT_UNIT_PRICES, type MessageCreditUnitPriceKey } from './message-credit-unit-prices';

/**
 * Billing rules (enabled flags + labels + version). Default prices and inclusion flags live in
 * {@link MESSAGE_CREDIT_UNIT_CONFIG} (`message-credit-unit-prices.ts`).
 */
/** Version string stored on ledger rows and echoed in `creditRule` summaries. Bump when rule keys or defaults change materially. */
export const CHAT_MESSAGE_CREDIT_RULE_VERSION = 'v4';

export type ChatMessageCreditRuleKey = MessageCreditUnitPriceKey;

export type ChatMessageCreditRule = {
  /** When false, `creditsUsed` is 0 but configured amount is still recorded for analytics. */
  enabled: boolean;
  /** Supports fractional credits (e.g. 0.5). */
  credits: number;
  /**
   * When false (and {@link ChatMessageCreditRule.enabled} is true), breakdown still lists the row
   * but it contributes **0** to `creditsUsed` / message `creditCost`.
   */
  includeInTotalCredits: boolean;
};

export const CHAT_MESSAGE_CREDIT_RULES: Record<ChatMessageCreditRuleKey, ChatMessageCreditRule> = {
  text_message: {
    enabled: true,
    credits: MESSAGE_CREDIT_UNIT_PRICES.text_message,
    includeInTotalCredits: MESSAGE_CREDIT_UNIT_CONFIG.text_message.includeInTotalCredits,
  },
  suggested_question_message: {
    enabled: true,
    credits: MESSAGE_CREDIT_UNIT_PRICES.suggested_question_message,
    includeInTotalCredits: MESSAGE_CREDIT_UNIT_CONFIG.suggested_question_message.includeInTotalCredits,
  },
  quick_reply_message: {
    enabled: true,
    credits: MESSAGE_CREDIT_UNIT_PRICES.quick_reply_message,
    includeInTotalCredits: MESSAGE_CREDIT_UNIT_CONFIG.quick_reply_message.includeInTotalCredits,
  },
  voice_message: {
    enabled: true,
    credits: MESSAGE_CREDIT_UNIT_PRICES.voice_message,
    includeInTotalCredits: MESSAGE_CREDIT_UNIT_CONFIG.voice_message.includeInTotalCredits,
  },
  dictation_session: {
    enabled: true,
    credits: MESSAGE_CREDIT_UNIT_PRICES.dictation_session,
    includeInTotalCredits: MESSAGE_CREDIT_UNIT_CONFIG.dictation_session.includeInTotalCredits,
  },
  attachment_message: {
    enabled: false,
    credits: MESSAGE_CREDIT_UNIT_PRICES.attachment_message,
    includeInTotalCredits: MESSAGE_CREDIT_UNIT_CONFIG.attachment_message.includeInTotalCredits,
  },
  unknown_message: {
    enabled: true,
    credits: MESSAGE_CREDIT_UNIT_PRICES.unknown_message,
    includeInTotalCredits: MESSAGE_CREDIT_UNIT_CONFIG.unknown_message.includeInTotalCredits,
  },
};

/** Human labels for persisted `creditBreakdown` rows and UI. */
export const CHAT_MESSAGE_CREDIT_BREAKDOWN_LABELS: Record<ChatMessageCreditRuleKey, string> = {
  text_message: 'Text message',
  suggested_question_message: 'Suggested question',
  quick_reply_message: 'Quick reply',
  voice_message: 'Voice message',
  dictation_session: 'Dictation',
  attachment_message: 'Attachment',
  unknown_message: 'Unknown',
};
