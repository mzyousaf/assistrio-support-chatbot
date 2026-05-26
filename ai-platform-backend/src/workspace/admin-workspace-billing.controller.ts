import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';

/**
 * Staff read-only workspace billing visibility (`/api/admin/workspaces/:workspaceId/billing/summary`).
 */
@Controller('api/admin/workspaces')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminWorkspaceBillingController {
  constructor(private readonly billingSummaryService: WorkspaceBillingSummaryService) {}

  @Get(':workspaceId/billing/summary')
  getBillingSummary(@Param('workspaceId') workspaceId: string) {
    return this.billingSummaryService.getAdminSummary(workspaceId);
  }
}
