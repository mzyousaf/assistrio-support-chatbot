import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { VisitorsService } from '../visitors/visitors.service';
import { parseTrackPayload } from './track-payload.dto';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';

/**
 * **Internal analytics ingestion** — append-only events for operators (funnels, debugging).
 * **Read path:** none — this is write-only for clients; never document as a PV “analytics API”.
 * Authenticated reporting: `/api/user/analytics` — see `docs/ANALYTICS_BOUNDARIES.md`.
 * PV-facing summaries: `/api/public/visitor-*` — see `docs/PV_SAFE_PUBLIC_APIS.md`.
 *
 * **`X-API-Key`:** marketing site POSTs via same-origin Next proxy; browsers never send the key.
 */
@UseGuards(LandingSiteApiKeyGuard)
@Controller('api/analytics')
export class AnalyticsTrackController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly visitorsService: VisitorsService,
  ) {}

  @Post('track')
  async track(@Body() body: unknown) {
    const parsed = parseTrackPayload(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid payload' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.visitorsService.getOrCreateVisitor(parsed.platformVisitorId);
      await this.analyticsService.trackEvent(parsed);
      return { success: true };
    } catch (error) {
      console.error('Analytics tracking failed:', error);
      throw new HttpException(
        { error: 'Failed to track event' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
