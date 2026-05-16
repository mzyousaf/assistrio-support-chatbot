import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { BotsService } from '../bots/bots.service';
import { AnalyticsService } from './analytics.service';

/**
 * Global / per-bot analytics for staff (`/api/admin/analytics/*`, superadmin session only).
 */
@Controller('api/admin/analytics')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly botsService: BotsService,
  ) {}

  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getAnalyticsOverview({ from, to });
  }

  @Get('bots/summary')
  botsSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getBotsSummary({ from, to });
  }

  @Get('leads/summary')
  leadsSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getLeadsSummary({ from, to });
  }

  @Get()
  get() {
    return this.analyticsService.getSummary();
  }

  /** Superadmin may read any bot’s analytics detail. */
  @Get('bots/:id')
  async botDetail(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    return this.analyticsService.getBotAnalyticsDetail(id, { from, to });
  }
}
