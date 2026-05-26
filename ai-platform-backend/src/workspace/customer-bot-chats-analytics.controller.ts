import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerChatsAnalyticsService } from '../analytics/customer-chats-analytics.service';
import type { RequestUser } from '../auth/shared/request-user.types';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { BotsService } from '../bots/bots.service';
import { WorkspaceAnalyticsEntitlementService } from '../entitlements/workspace-analytics-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  requireCustomerBotAnalyticsAccess,
} from './shared/customer-bot-analytics-access.util';

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

/**
 * Tenant-scoped chats analytics time series + breakdowns (`GET /api/customer/bots/:id/analytics/chats`).
 */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotChatsAnalyticsController {
  constructor(
    private readonly customerChatsAnalyticsService: CustomerChatsAnalyticsService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly analyticsEntitlementService: WorkspaceAnalyticsEntitlementService,
  ) {}

  @Get(':id/analytics/chats')
  async chatsAnalytics(
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
      forbiddenCode: 'BOT_ANALYTICS_FORBIDDEN',
    });

    return this.customerChatsAnalyticsService.get(
      id,
      {
        from: pickQueryParam(query, 'from'),
        to: pickQueryParam(query, 'to'),
        granularity: pickQueryParam(query, 'granularity'),
        includePreview: pickQueryParam(query, 'includePreview'),
        startedFrom: pickQueryParam(query, 'startedFrom'),
        countryCode: pickQueryParam(query, 'countryCode'),
        deviceType: pickQueryParam(query, 'deviceType'),
      },
      { analyticsHistoryDays },
    );
  }
}
