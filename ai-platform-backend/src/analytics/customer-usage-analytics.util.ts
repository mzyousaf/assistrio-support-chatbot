import { BadRequestException } from '@nestjs/common';
import type { UsageLedgerUsageType } from '../models/usage-ledger.schema';
import { parseOverviewDateRange } from './analytics-date-range.util';
import {
  parseStartedFromQueryParam,
  type ConversationStartedFromKey,
  type CustomerChatsGranularity,
} from './customer-chats-analytics.util';

export type CustomerUsageQueryInput = {
  from?: string;
  to?: string;
  granularity?: string;
  includePreview?: string;
  usageType?: string;
  startedFrom?: string;
};

export type ParsedCustomerUsageQuery = {
  from: Date;
  to: Date;
  granularity: CustomerChatsGranularity;
  includePreview: boolean;
  usageType?: UsageLedgerUsageType;
  startedFrom?: ConversationStartedFromKey[];
};

const GRANULARITY_SET = new Set<string>(['hour', 'day', 'week', 'month']);

const STARTED_FROM_SET = new Set<string>([
  'playground_preview',
  'shared_preview',
  'runtime_widget',
  'runtime_iframe',
  'unknown',
]);

const USAGE_LEDGER_USAGE_TYPES = new Set<string>([
  'text_message',
  'voice_message',
  'dictation_message',
  'attachment_message',
  'suggested_question_message',
  'quick_reply_message',
  'unknown_message',
  'assistant_reply',
  'stt_seconds',
  'unknown',
]);

export function parseCustomerUsageQuery(input: CustomerUsageQueryInput): ParsedCustomerUsageQuery {
  const { from, to } = parseOverviewDateRange({ from: input.from, to: input.to });

  const gRaw = input.granularity?.trim().toLowerCase();
  const granularity = (gRaw && gRaw.length > 0 ? gRaw : 'day') as CustomerChatsGranularity;
  if (!GRANULARITY_SET.has(granularity)) {
    throw new BadRequestException({
      error: 'Invalid granularity. Use hour, day, week, or month.',
      errorCode: 'INVALID_GRANULARITY',
    });
  }

  const ipRaw = input.includePreview?.trim().toLowerCase();
  const includePreview = ipRaw !== 'false' && ipRaw !== '0';

  const startedFrom = parseStartedFromQueryParam(input.startedFrom);

  let usageType: UsageLedgerUsageType | undefined;
  const utRaw = input.usageType?.trim();
  if (utRaw) {
    if (!USAGE_LEDGER_USAGE_TYPES.has(utRaw)) {
      throw new BadRequestException({
        error: 'Invalid usageType filter.',
        errorCode: 'INVALID_USAGE_TYPE',
      });
    }
    usageType = utRaw as UsageLedgerUsageType;
  }

  return { from, to, granularity, includePreview, usageType, startedFrom };
}

export function usageLedgerUsageTypeLabel(usageType: string): string {
  switch (usageType) {
    case 'text_message':
      return 'Text message';
    case 'voice_message':
      return 'Voice message';
    case 'dictation_message':
      return 'Dictation message';
    case 'attachment_message':
      return 'Attachment message';
    case 'suggested_question_message':
      return 'Suggested question';
    case 'quick_reply_message':
      return 'Quick reply';
    case 'unknown_message':
    case 'unknown':
      return 'Unknown';
    case 'assistant_reply':
      return 'Assistant reply';
    case 'stt_seconds':
      return 'Speech (STT)';
    default:
      return usageType.replace(/_/g, ' ');
  }
}

/** Ledger rows that represent a visitor user message (not assistant reply / raw STT lines). */
export function isUserMessageUsageType(usageType: string): boolean {
  return (
    usageType === 'text_message' ||
    usageType === 'voice_message' ||
    usageType === 'dictation_message' ||
    usageType === 'attachment_message' ||
    usageType === 'suggested_question_message' ||
    usageType === 'quick_reply_message' ||
    usageType === 'unknown_message'
  );
}

export function messageInputTypeToUsageLabel(inputType: string | undefined | null): string {
  const s = String(inputType ?? '').trim();
  switch (s) {
    case 'text':
      return 'Text message';
    case 'voice':
      return 'Voice message';
    case 'dictation':
      return 'Dictation message';
    case 'attachment':
      return 'Attachment message';
    case 'suggested_question':
      return 'Suggested question';
    case 'quick_reply':
      return 'Quick reply';
    default:
      return 'Unknown';
  }
}
