import type { MessageInputType, MessageVoiceMeta } from '../models/message.schema';
import type { UsageLedgerUsageType } from '../models/usage-ledger.schema';
import {
  CHAT_MESSAGE_CREDIT_BREAKDOWN_LABELS,
  CHAT_MESSAGE_CREDIT_RULES,
  CHAT_MESSAGE_CREDIT_RULE_VERSION,
  type ChatMessageCreditRule,
  type ChatMessageCreditRuleKey,
} from './chat-credit-rules.constant';

export const CHAT_MESSAGE_BILLING_TYPE = 'message_credit';

export const CREDIT_RULE_FINGERPRINT_ORDER: ChatMessageCreditRuleKey[] = [
  'text_message',
  'suggested_question_message',
  'quick_reply_message',
  'voice_message',
  'dictation_session',
  'attachment_message',
  'unknown_message',
];

/** Minimal fields required for composite billing components. */
export type ResolveMessageCreditRuleInput = {
  inputType?: MessageInputType;
  inputMethod?: string;
  voiceMeta?: MessageVoiceMeta | null;
  hasAttachments?: boolean;
  /** True when visible user transcript / typed content is non-empty. */
  hasTextContent?: boolean;
};

export function buildChatCreditRuleFingerprint(
  rules: Readonly<Record<ChatMessageCreditRuleKey, ChatMessageCreditRule>> = CHAT_MESSAGE_CREDIT_RULES,
  version: string = CHAT_MESSAGE_CREDIT_RULE_VERSION,
): string {
  const parts = CREDIT_RULE_FINGERPRINT_ORDER.map((k) => {
    const r = rules[k];
    const short =
      k === 'dictation_session' ? 'dict_session' : k.endsWith('_message') ? k.replace(/_message$/, '') : k;
    return r.enabled ? `${short}=${r.credits}` : `${short}=disabled`;
  });
  return `${version}:${parts.join(',')}`;
}

/** Ledger primary modality (`UsageLedger.usageType`): distinct from per-component breakdown rows. */
export function resolveLedgerPrimaryUsageType(input: ResolveMessageCreditRuleInput): UsageLedgerUsageType {
  const vm = input.voiceMeta;
  const it = input.inputType;
  const method = String(input.inputMethod ?? '').trim();
  const hasText = input.hasTextContent === true;

  if (vm?.isVoiceMessage === true || it === 'voice') return 'voice_message';

  if (
    vm?.isDictationMessage === true ||
    it === 'dictation' ||
    method === 'browser_speech_recognition' ||
    method === 'microphone_transcription'
  ) {
    return 'dictation_message';
  }

  if (it === 'suggested_question') return 'suggested_question_message';
  if (it === 'quick_reply') return 'quick_reply_message';
  if (it === 'text' || hasText) return 'text_message';
  if (it === 'attachment' || input.hasAttachments === true) return 'attachment_message';
  if (it === 'unknown') return 'unknown_message';

  return 'unknown_message';
}

/** @deprecated Prefer {@link resolveLedgerPrimaryUsageType}. */
export function resolveMessageCreditRuleKey(input: ResolveMessageCreditRuleInput): UsageLedgerUsageType {
  return resolveLedgerPrimaryUsageType(input);
}

export type MessageCreditBreakdownRow = {
  key: ChatMessageCreditRuleKey;
  label: string;
  count: number;
  creditsEach: number;
  creditsUsed: number;
  billable: boolean;
};

export type MessageCreditCalculation = {
  usageType: UsageLedgerUsageType;
  creditsUsed: number;
  configuredCredits: number;
  billable: boolean;
  creditReason: string;
  billingType: string;
  creditRule: string;
  creditRuleVersion: string;
  breakdown: MessageCreditBreakdownRow[];
};

function ruleRow(
  key: ChatMessageCreditRuleKey,
  rules: Readonly<Record<ChatMessageCreditRuleKey, ChatMessageCreditRule>>,
  count: number,
): MessageCreditBreakdownRow | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null;
  const rule = rules[key];
  const creditsEachRaw = typeof rule.credits === 'number' && Number.isFinite(rule.credits) ? rule.credits : 0;
  const billable = rule.enabled === true;
  const creditsUsed = billable ? creditsEachRaw * count : 0;
  const label = CHAT_MESSAGE_CREDIT_BREAKDOWN_LABELS[key] ?? key;
  return { key, label, count, creditsEach: creditsEachRaw, creditsUsed, billable };
}

export function resolvedDictationSessionCount(isDictation: boolean, voiceMeta?: MessageVoiceMeta | null): number {
  if (!isDictation) return 0;
  const raw = voiceMeta?.dictationSessionCount;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    if (n >= 2) return n;
    if (n === 1) return 1;
    if (n === 0) return 1;
  }
  return 1;
}

function buildCreditReasonFromBreakdown(breakdown: MessageCreditBreakdownRow[]): {
  creditReason: string;
  billable: boolean;
  creditsUsed: number;
  configuredCredits: number;
} {
  const creditsUsed = breakdown.reduce((a, k) => a + (Number.isFinite(k.creditsUsed) ? k.creditsUsed : 0), 0);
  const configuredCredits = breakdown.reduce((a, k) => a + Math.max(0, k.count) * k.creditsEach, 0);
  const billable = breakdown.some((b) => b.billable && b.creditsUsed > 0);

  const keys = [...new Set(breakdown.filter((b) => b.billable && b.creditsUsed > 0).map((b) => b.key))].sort();
  const attachmentOnlyTransparency =
    breakdown.length === 1 && breakdown[0].key === 'attachment_message' && !breakdown[0].billable;

  let creditReason: string;
  if (attachmentOnlyTransparency) creditReason = 'attachment_message_not_billable';
  else if (keys.length === 0) creditReason = 'none_not_billable';
  else if (keys.length === 1 && keys[0]) creditReason = keys[0];
  else creditReason = `composite:${keys.join('+')}`;

  return { creditReason, billable, creditsUsed, configuredCredits };
}

export function calculateMessageCreditUsage(
  input: ResolveMessageCreditRuleInput,
  rules: Readonly<Record<ChatMessageCreditRuleKey, ChatMessageCreditRule>> = CHAT_MESSAGE_CREDIT_RULES,
  ruleVersion: string = CHAT_MESSAGE_CREDIT_RULE_VERSION,
): MessageCreditCalculation {
  const vm = input.voiceMeta;
  const it = input.inputType ?? 'unknown';
  const method = String(input.inputMethod ?? '').trim();
  const hasText = input.hasTextContent === true;
  const hasAtt = input.hasAttachments === true;

  const isVoice = vm?.isVoiceMessage === true || it === 'voice';
  const isDictation =
    !isVoice &&
    (vm?.isDictationMessage === true ||
      it === 'dictation' ||
      method === 'browser_speech_recognition' ||
      method === 'microphone_transcription');
  const sessionCount = resolvedDictationSessionCount(isDictation, vm);

  const breakdown: MessageCreditBreakdownRow[] = [];
  const push = (key: ChatMessageCreditRuleKey, count: number) => {
    const row = ruleRow(key, rules, count);
    if (row) breakdown.push(row);
  };

  if (isVoice) {
    push('voice_message', 1);
    if (hasAtt) push('attachment_message', 1);
  } else if (isDictation) {
    if (hasText) push('text_message', 1);
    push('dictation_session', sessionCount);
    if (hasAtt) push('attachment_message', 1);
  } else if (it === 'suggested_question' && hasText) {
    push('suggested_question_message', 1);
    if (hasAtt) push('attachment_message', 1);
  } else if (it === 'quick_reply') {
    push('quick_reply_message', 1);
    if (hasAtt) push('attachment_message', 1);
  } else if (hasText || it === 'text') {
    push('text_message', 1);
    if (hasAtt) push('attachment_message', 1);
  } else if (hasAtt || it === 'attachment') {
    push('attachment_message', 1);
  } else if (it === 'unknown') {
    push('unknown_message', 1);
  } else {
    push('unknown_message', 1);
  }

  const { creditReason, billable, creditsUsed, configuredCredits } = buildCreditReasonFromBreakdown(breakdown);
  const usageType = resolveLedgerPrimaryUsageType(input);

  return {
    usageType,
    creditsUsed,
    configuredCredits,
    billable,
    creditReason,
    billingType: CHAT_MESSAGE_BILLING_TYPE,
    creditRule: buildChatCreditRuleFingerprint(rules, ruleVersion),
    creditRuleVersion: ruleVersion,
    breakdown,
  };
}
