import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import { AdminCustomersService } from './admin-customers.service';

/**
 * Staff customer directory (`/api/admin/customers/*`, superadmin session only).
 */
@Controller('api/admin/customers')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminCustomersController {
  constructor(
    private readonly adminCustomersService: AdminCustomersService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminCustomersService.listCustomers({ q, page, limit });
  }

  @Get(':customerId/workspaces')
  workspaces(@Param('customerId') customerId: string) {
    return this.adminCustomersService.getCustomerWorkspaces(customerId);
  }

  @Get(':customerId/bots')
  bots(@Param('customerId') customerId: string) {
    return this.adminCustomersService.getCustomerBots(customerId);
  }

  @Get(':customerId/analytics/overview')
  analyticsOverview(
    @Param('customerId') customerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getCustomerAnalyticsOverview(customerId, { from, to });
  }

  @Get(':customerId')
  detail(@Param('customerId') customerId: string) {
    return this.adminCustomersService.getCustomer(customerId);
  }
}
