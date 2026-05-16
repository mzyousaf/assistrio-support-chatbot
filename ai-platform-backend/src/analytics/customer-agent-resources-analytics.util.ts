import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_OVERVIEW_RANGE_DAYS,
  parseOverviewDateRange,
} from './analytics-date-range.util';
import type {
  ConversationStartedFromKey,
  CustomerChatsGranularity,
} from './customer-chats-analytics.util';

export type CustomerAgentResourcesAnalyticsQueryInput = {
  from?: string;
  to?: string;
  granularity?: string;
  includePreview?: string;
  startedFrom?: string;
};

export type ParsedCustomerAgentResourcesAnalyticsQuery = {
  from: Date;
  to: Date;
  granularity: CustomerChatsGranularity;
  includePreview: boolean;
  startedFrom?: ConversationStartedFromKey;
};

const GRANULARITY_SET = new Set<string>(['hour', 'day', 'week', 'month']);

const STARTED_FROM_SET = new Set<string>([
  'playground_preview',
  'shared_preview',
  'runtime_widget',
  'runtime_iframe',
  'unknown',
]);

export function parseCustomerAgentResourcesAnalyticsQuery(
  input: CustomerAgentResourcesAnalyticsQueryInput,
): ParsedCustomerAgentResourcesAnalyticsQuery {
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

  let startedFrom: ConversationStartedFromKey | undefined;
  const sfRaw = input.startedFrom?.trim().toLowerCase();
  if (sfRaw) {
    if (!STARTED_FROM_SET.has(sfRaw)) {
      throw new BadRequestException({
        error: 'Invalid startedFrom filter.',
        errorCode: 'INVALID_STARTED_FROM',
      });
    }
    startedFrom = sfRaw as ConversationStartedFromKey;
  }

  return { from, to, granularity, includePreview, startedFrom };
}

export { DEFAULT_OVERVIEW_RANGE_DAYS };
