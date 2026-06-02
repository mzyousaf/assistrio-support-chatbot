import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { BillingAdminSyncService } from '../billing/billing-admin-sync.service';
import { AdminWorkspaceSupportService } from './admin-workspace-support.service';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';

/**
 * Staff read-only workspace billing visibility (`/api/admin/workspaces/:workspaceId/billing/summary`).
 */
@Controller('api/admin/workspaces')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminWorkspaceBillingController {
  constructor(
    private readonly billingSummaryService: WorkspaceBillingSummaryService,
    private readonly billingAdminSyncService: BillingAdminSyncService,
    private readonly adminWorkspaceSupportService: AdminWorkspaceSupportService,
  ) {}

  @Get(':workspaceId/billing/summary')
  getBillingSummary(@Param('workspaceId') workspaceId: string) {
    return this.billingSummaryService.getAdminSummary(workspaceId);
  }

  @Post(':workspaceId/billing/sync')
  syncBilling(@Param('workspaceId') workspaceId: string) {
    return this.billingAdminSyncService.syncWorkspaceBilling(workspaceId);
  }

  @Get(':workspaceId/support-summary')
  getSupportSummary(@Param('workspaceId') workspaceId: string) {
    return this.adminWorkspaceSupportService.getSupportSummary(workspaceId);
  }

  @Get(':workspaceId/usage/analytics')
  getUsageAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('botIds') botIds?: string,
  ) {
    return this.adminWorkspaceSupportService.getUsageAnalytics(workspaceId, { startDate, endDate, botIds });
  }
}
