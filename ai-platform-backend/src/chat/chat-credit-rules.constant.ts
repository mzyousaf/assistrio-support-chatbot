/** Version string stored on ledger rows and echoed in `creditRule` summaries. Bump when rule keys or defaults change materially. */
export const CHAT_MESSAGE_CREDIT_RULE_VERSION = 'v2';

export type ChatMessageCreditRuleKey =
  | 'text_message'
  | 'suggested_question_message'
  | 'quick_reply_message'
  | 'voice_message'
  /** Billed per Whisper/browser dictation session merged into composer before send */
  | 'dictation_session'
  | 'attachment_message'
  | 'unknown_message';

export type ChatMessageCreditRule = {
  /** When false, `creditsUsed` is 0 but configured amount is still recorded for analytics. */
  enabled: boolean;
  /** Supports fractional credits (e.g. 0.5). */
  credits: number;
};

export const CHAT_MESSAGE_CREDIT_RULES: Record<ChatMessageCreditRuleKey, ChatMessageCreditRule> = {
  text_message: {
    enabled: true,
    credits: 1,
  },
  suggested_question_message: {
    enabled: true,
    credits: 1,
  },
  quick_reply_message: {
    enabled: true,
    credits: 1,
  },
  voice_message: {
    enabled: true,
    credits: 2,
  },
  dictation_session: {
    enabled: true,
    credits: 2,
  },
  attachment_message: {
    enabled: false,
    credits: 1,
  },
  unknown_message: {
    enabled: true,
    credits: 1,
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
