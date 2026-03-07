import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../super-admin/super-admin.guard';
import { AnalyticsService } from './analytics.service';

@Controller('api/super-admin/analytics')
@UseGuards(SuperAdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  get() {
    return this.analyticsService.getSummary();
  }
}
