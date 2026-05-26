import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerTopicsAnalyticsService } from '../analytics/customer-topics-analytics.service';
import type { RequestUser } from '../auth/shared/request-user.types';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { BotsService } from '../bots/bots.service';
import { WorkspaceAnalyticsEntitlementService } from '../entitlements/workspace-analytics-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  clampAnalyticsFromToQuery,
  requireCustomerBotAnalyticsAccess,
} from './shared/customer-bot-analytics-access.util';
import { withAnalyticsWindowMetadata } from './shared/customer-bot-analytics-request.util';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function pickQueryParam(
  query: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = query[key];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotTopicsAnalyticsController {
  constructor(
    private readonly customerTopicsAnalyticsService: CustomerTopicsAnalyticsService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly analyticsEntitlementService: WorkspaceAnalyticsEntitlementService,
  ) {}

  @Get(':id/analytics/topics')
  async topicsAnalytics(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    const { analyticsHistoryDays } = await requireCustomerBotAnalyticsAccess({
      req,
      botId: id,
      botsService: this.botsService,
      workspacesService: this.workspacesService,
      analyticsEntitlementService: this.analyticsEntitlementService,
      forbiddenCode: 'BOT_TOPICS_ANALYTICS_FORBIDDEN',
    });
    const clamped = clampAnalyticsFromToQuery(
      pickQueryParam(query, 'from'),
      pickQueryParam(query, 'to'),
      analyticsHistoryDays,
    );
    const result = await this.customerTopicsAnalyticsService.get(id, {
      from: clamped.from,
      to: clamped.to,
      granularity: pickQueryParam(query, 'granularity'),
      includePreview: pickQueryParam(query, 'includePreview'),
      startedFrom: pickQueryParam(query, 'startedFrom'),
      topic: pickQueryParam(query, 'topic'),
      messageTopicScope: pickQueryParam(query, 'messageTopicScope'),
      growthMetric: pickQueryParam(query, 'growthMetric'),
    });
    return withAnalyticsWindowMetadata(result as Record<string, unknown>, clamped.window);
  }
}
