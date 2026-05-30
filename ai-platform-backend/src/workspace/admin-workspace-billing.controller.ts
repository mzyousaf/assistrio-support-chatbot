import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { BillingAdminSyncService } from '../billing/billing-admin-sync.service';
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
  ) {}

  @Get(':workspaceId/billing/summary')
  getBillingSummary(@Param('workspaceId') workspaceId: string) {
    return this.billingSummaryService.getAdminSummary(workspaceId);
  }

  @Post(':workspaceId/billing/sync')
  syncBilling(@Param('workspaceId') workspaceId: string) {
    return this.billingAdminSyncService.syncWorkspaceBilling(workspaceId);
  }
}
