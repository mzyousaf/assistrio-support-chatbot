import type { UpdateQuery } from 'mongoose';
import type { Conversation } from '../models/conversation.schema';
import type { MessageAttachment, MessageInputType, MessageVoiceMeta } from '../models/message.schema';
import type { MessageSource } from '../models/message.schema';
import type { UsageLedgerUsageType } from '../models/usage-ledger.schema';
import type { ResolveMessageCreditRuleInput } from './message-credit.util';
import { resolveLedgerPrimaryUsageType } from './message-credit.util';

/** Minimal message shape for rollup (avoids full Mongoose doc typing). */
export type ConversationTurnUserMessageLike = {
  createdAt?: Date;
  inputType?: MessageInputType;
  inputMethod?: string;
  voiceMeta?: MessageVoiceMeta | null;
  attachments?: MessageAttachment[];
  attachmentCount?: number;
  /** When true, the user-visible text / transcript was non-empty (billing hint). */
  hasTextContent?: boolean;
  creditCost?: number;
};

export type ConversationTurnAssistantMessageLike = {
  createdAt?: Date;
  sources?: MessageSource[];
};

export type ConversationTurnBeforeLike = {
  firstUserMessageAt?: Date | null;
};

function numCredit(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return v;
}

export type UserInputCounterField =
  | 'textMessageCount'
  | 'voiceMessageCount'
  | 'dictationMessageCount'
  | 'attachmentMessageCount'
  | 'quickReplyMessageCount'
  | 'suggestedQuestionMessageCount';

export function userTurnFlags(input: {
  inputType?: MessageInputType;
  voiceMeta?: MessageVoiceMeta | null;
  attachmentCount?: number;
}): { hasVoice?: boolean; hasDictation?: boolean; hasAttachment?: boolean } {
  const vm = input.voiceMeta;
  const hasVoice = input.inputType === 'voice' || vm?.isVoiceMessage === true;
  const hasDictation = input.inputType === 'dictation' || vm?.isDictationMessage === true;
  const attN = typeof input.attachmentCount === 'number' ? input.attachmentCount : 0;
  const hasAttachment = attN > 0 || input.inputType === 'attachment';
  const out: { hasVoice?: boolean; hasDictation?: boolean; hasAttachment?: boolean } = {};
  if (hasVoice) out.hasVoice = true;
  if (hasDictation) out.hasDictation = true;
  if (hasAttachment) out.hasAttachment = true;
  return out;
}

function primaryUsageCounterField(primary: UsageLedgerUsageType): UserInputCounterField | undefined {
  switch (primary) {
    case 'text_message':
      return 'textMessageCount';
    case 'voice_message':
      return 'voiceMessageCount';
    case 'dictation_message':
      return 'dictationMessageCount';
    case 'attachment_message':
      return undefined;
    case 'suggested_question_message':
      return 'suggestedQuestionMessageCount';
    case 'quick_reply_message':
      return 'quickReplyMessageCount';
    case 'unknown_message':
      return 'textMessageCount';
    default:
      return undefined;
  }
}

/**
 * Historic single-counter hint (conversation patch applies multi counters separately).
 */
export function resolveUserInputTypeCounterKey(input: ResolveMessageCreditRuleInput): UserInputCounterField {
  const primary = resolveLedgerPrimaryUsageType({
    ...input,
    hasAttachments: input.hasAttachments ?? false,
    hasTextContent: input.hasTextContent ?? false,
  });
  return primaryUsageCounterField(primary) ?? 'attachmentMessageCount';
}

function bump(inc: Record<string, number>, field: UserInputCounterField): void {
  inc[field] = (inc[field] ?? 0) + 1;
}

export function buildConversationTurnAnalyticsPatch(input: {
  userMessage: ConversationTurnUserMessageLike;
  assistantMessage: ConversationTurnAssistantMessageLike;
  conversationBefore?: ConversationTurnBeforeLike | null;
}): UpdateQuery<Conversation> {
  const userAt = input.userMessage.createdAt ?? new Date();
  const asstAt = input.assistantMessage.createdAt ?? new Date();
  const lastAt = asstAt.getTime() >= userAt.getTime() ? asstAt : userAt;

  const attachmentCountExplicit =
    typeof input.userMessage.attachmentCount === 'number' ? input.userMessage.attachmentCount : undefined;
  const attachmentCountFallback = Array.isArray(input.userMessage.attachments)
    ? input.userMessage.attachments.length
    : 0;
  let attCount = Math.max(0, attachmentCountExplicit ?? attachmentCountFallback);
  if (attCount <= 0 && input.userMessage.inputType === 'attachment') {
    attCount = 1;
  }

  const um = input.userMessage;
  const vm = um.voiceMeta;
  const it = um.inputType ?? 'unknown';
  const method = String(um.inputMethod ?? '').trim();
  const hasText = um.hasTextContent === true;

  const isVoice = vm?.isVoiceMessage === true || it === 'voice';
  const isDictation =
    !isVoice &&
    (vm?.isDictationMessage === true ||
      it === 'dictation' ||
      method === 'browser_speech_recognition' ||
      method === 'microphone_transcription');

  const creditDelta = numCredit(input.userMessage.creditCost);
  const sourcesLen = Array.isArray(input.assistantMessage.sources) ? input.assistantMessage.sources.length : 0;

  const inc: Record<string, number> = {
    totalUserMessages: 1,
    totalAssistantMessages: 1,
    totalMessages: 2,
    totalCreditsUsed: creditDelta,
    sourcesUsedCount: sourcesLen,
  };

  if (isVoice) {
    bump(inc, 'voiceMessageCount');
  } else if (isDictation) {
    bump(inc, 'dictationMessageCount');
    if (hasText) bump(inc, 'textMessageCount');
  } else if (it === 'suggested_question') {
    bump(inc, 'suggestedQuestionMessageCount');
  } else if (it === 'quick_reply') {
    bump(inc, 'quickReplyMessageCount');
  } else if (hasText) {
    bump(inc, 'textMessageCount');
  } else if (it === 'unknown') {
    bump(inc, 'textMessageCount');
  }

  if (attCount > 0) bump(inc, 'attachmentMessageCount');

  const flags = userTurnFlags({
    inputType: input.userMessage.inputType,
    voiceMeta: input.userMessage.voiceMeta,
    attachmentCount: attCount,
  });

  const $set: Record<string, unknown> = {
    lastUserMessageAt: userAt,
    lastAssistantMessageAt: asstAt,
    lastMessageAt: lastAt,
    lastActivityAt: lastAt,
    ...flags,
  };

  if (!input.conversationBefore?.firstUserMessageAt) {
    $set.firstUserMessageAt = userAt;
  }

  return {
    $inc: inc,
    $set: $set,
  };
}

/** Merge prior lead keys with keys from captured data (sorted, deduped). */
export function mergeLeadFieldKeys(existing: string[] | undefined | null, capturedKeys: string[]): string[] {
  const s = new Set<string>();
  for (const k of existing ?? []) {
    const t = String(k ?? '').trim();
    if (t) s.add(t);
  }
  for (const k of capturedKeys) {
    const t = String(k ?? '').trim();
    if (t) s.add(t);
  }
  return [...s].sort();
}
