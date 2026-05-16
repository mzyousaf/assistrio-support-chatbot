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
import { CustomerAgentResourcesAnalyticsService } from '../analytics/customer-agent-resources-analytics.service';
import type { RequestUser } from '../auth/shared/request-user.types';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

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
 * Tenant-scoped combined credits + KB primary-source aggregates:
 * GET /api/customer/bots/:id/analytics/agent-resources
 */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotAgentResourcesAnalyticsController {
  constructor(
    private readonly agentResourcesAnalyticsService: CustomerAgentResourcesAnalyticsService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Get(':id/analytics/agent-resources')
  async agentResourcesAnalytics(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new ForbiddenException({ error: 'Forbidden', errorCode: 'BOT_ANALYTICS_FORBIDDEN' });
    }

    return this.agentResourcesAnalyticsService.get(id, {
      from: pickQueryParam(query, 'from'),
      to: pickQueryParam(query, 'to'),
      granularity: pickQueryParam(query, 'granularity'),
      includePreview: pickQueryParam(query, 'includePreview'),
      startedFrom: pickQueryParam(query, 'startedFrom'),
    });
  }
}
