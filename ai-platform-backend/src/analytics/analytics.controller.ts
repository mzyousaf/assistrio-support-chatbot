import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AnalyticsService } from './analytics.service';

/**
 * **Internal / authenticated** analytics — operator dashboard only.
 * - Not for anonymous PV clients; never expose these contracts on `/api/public/*`.
 * - Raw ingestion remains `POST /api/analytics/track` (see `AnalyticsTrackController`).
 *
 * @see docs/ANALYTICS_BOUNDARIES.md (ingestion vs internal vs PV-safe — do not merge layers)
 * @see docs/PV_SAFE_PUBLIC_APIS.md (PV vs internal boundary)
 * @see docs/INTERNAL_ANALYTICS.md (product model & `/api/user/analytics/*` map)
 */
@Controller('api/user/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Time-bounded dashboard overview (`from` / `to` as ISO 8601). Defaults: last 30 days.
   * Query: `?from=&to=` optional.
   */
  @Get('overview')
  overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getAnalyticsOverview({ from, to });
  }

  /**
   * Per-bot table metrics for the selected range (internal dashboard).
   * Declared before `bots/:id` so `summary` is not captured as an id.
   */
  @Get('bots/summary')
  botsSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getBotsSummary({ from, to });
  }

  /** Lead capture aggregates for the range — counts only, no raw field values. */
  @Get('leads/summary')
  leadsSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getLeadsSummary({ from, to });
  }

  /** Single-bot internal analytics (no secretKey). */
  @Get('bots/:id')
  botDetail(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getBotAnalyticsDetail(id, { from, to });
  }

  /** Lifetime totals + recent events (legacy snapshot). Prefer `GET .../overview` for date ranges. */
  @Get()
  get() {
    return this.analyticsService.getSummary();
  }
}
