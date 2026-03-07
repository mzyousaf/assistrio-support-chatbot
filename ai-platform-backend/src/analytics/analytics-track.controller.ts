import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { VisitorsService } from '../visitors/visitors.service';
import { parseTrackPayload } from './track-payload.dto';

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
      await this.visitorsService.getOrCreateVisitor(parsed.visitorId);
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
