import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AnalyticsService } from '../analytics/analytics.service';
import type { RequestUser } from '../auth/shared/request-user.types';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Customer-safe bot insights (tenant-scoped). Does not expose admin/global analytics.
 */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotInsightsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Get(':id/insights')
  async insights(@Req() req: RequestWithUser, @Param('id') id: string) {
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new NotFoundException('AI Agent not found');
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new ForbiddenException({ error: 'Forbidden', errorCode: 'BOT_INSIGHTS_FORBIDDEN' });
    }
    return this.analyticsService.getCustomerBotInsights(id);
  }
}
