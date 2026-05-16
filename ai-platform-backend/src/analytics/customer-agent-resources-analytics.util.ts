import { BadRequestException } from '@nestjs/common';
import { DEFAULT_OVERVIEW_RANGE_DAYS, parseOverviewDateRange } from './analytics-date-range.util';
import {
  parseStartedFromQueryParam,
  type ConversationStartedFromKey,
  type CustomerChatsGranularity,
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
  startedFrom?: ConversationStartedFromKey[];
};

const GRANULARITY_SET = new Set<string>(['hour', 'day', 'week', 'month']);

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

  const startedFrom = parseStartedFromQueryParam(input.startedFrom);

  return { from, to, granularity, includePreview, startedFrom };
}

export { DEFAULT_OVERVIEW_RANGE_DAYS };
