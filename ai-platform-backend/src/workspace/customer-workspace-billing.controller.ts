import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { BillingInvoicesService } from '../billing/billing-invoices.service';
import { BillingProfileService } from '../billing/billing-profile.service';
import { BillingManageService } from '../billing/billing-manage.service';
import { BillingSubscriptionActionsService } from '../billing/billing-subscription-actions.service';
import { BillingAddonActionsService } from '../billing/billing-addon-actions.service';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';
import {
  billingInvoicePdfQueryMetadata,
  createBillingInvoicePdfRequestId,
} from '../billing/billing-invoice-pdf-log.util';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceBillingController {
  private readonly logger = new Logger(CustomerWorkspaceBillingController.name);

  constructor(
    private readonly billingSummaryService: WorkspaceBillingSummaryService,
    private readonly billingSubscriptionActionsService: BillingSubscriptionActionsService,
    private readonly billingAddonActionsService: BillingAddonActionsService,
    private readonly billingManageService: BillingManageService,
    private readonly billingInvoicesService: BillingInvoicesService,
    private readonly billingProfileService: BillingProfileService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private async assertWorkspaceMember(req: RequestWithUser, workspaceId: string): Promise<RequestUser> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }

    const isMember = await this.workspacesService.isUserMemberOfWorkspace(String(user._id), workspaceId);
    if (!isMember) {
      throw new ForbiddenException({ error: 'Workspace access denied.' });
    }

    return user;
  }

  private async assertWorkspaceBillingViewer(
    req: RequestWithUser,
    workspaceId: string,
  ): Promise<RequestUser> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }
    await this.workspacesService.assertWorkspaceAdmin(String(user._id), workspaceId);
    return user;
  }

  private async assertWorkspaceOwner(req: RequestWithUser, workspaceId: string): Promise<RequestUser> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }
    await this.workspacesService.assertWorkspaceOwner(String(user._id), workspaceId);
    return user;
  }

  @Get(':workspaceId/billing/summary')
  async getBillingSummary(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.billingSummaryService.getSummary(workspaceId);
  }

  @Get(':workspaceId/billing/profile')
  async getBillingProfile(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceBillingViewer(req, workspaceId);
    const profile = await this.billingProfileService.getProfile(workspaceId);
    return { profile };
  }

  @Patch(':workspaceId/billing/profile')
  async patchBillingProfile(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body()
    body: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      taxId?: string;
      email?: string;
      notes?: string;
    },
  ) {
    const user = await this.assertWorkspaceBillingViewer(req, workspaceId);
    const profile = await this.billingProfileService.upsertProfile(
      workspaceId,
      String(user._id),
      body,
    );
    return { profile };
  }

  @Get(':workspaceId/billing/invoices')
  async listBillingInvoices(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceBillingViewer(req, workspaceId);
    return this.billingInvoicesService.listWorkspaceInvoices(workspaceId);
  }

  @Get(':workspaceId/billing/history/download')
  async downloadBillingHistory(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    await this.assertWorkspaceBillingViewer(req, workspaceId);
    const csv = await this.billingInvoicesService.exportBillingHistoryCsv(workspaceId);
    const filename = this.billingInvoicesService.getBillingHistoryCsvFilename();

    res
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Cache-Control', 'private, no-store')
      .send(csv);
  }

  @Post(':workspaceId/billing/invoices/:billingItemId/download')
  async downloadBillingInvoice(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('billingItemId') billingItemId: string,
    @Body()
    body: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      notes?: string;
      locale?: string;
    },
  ) {
    await this.assertWorkspaceBillingViewer(req, workspaceId);
    return this.billingInvoicesService.downloadBillingItemPdf(workspaceId, billingItemId, body);
  }

  @Get(':workspaceId/billing/invoices/:billingItemId/pdf')
  async streamBillingInvoicePdf(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('billingItemId') billingItemId: string,
    @Query()
    query: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      notes?: string;
      locale?: string;
      email?: string;
      taxId?: string;
      saveProfile?: string;
    },
    @Res() res: FastifyReply,
  ) {
    const user = await this.assertWorkspaceBillingViewer(req, workspaceId);
    const requestId = createBillingInvoicePdfRequestId();
    const queryMeta = billingInvoicePdfQueryMetadata(query);
    const saveProfile = String(query.saveProfile ?? '').trim().toLowerCase() === 'true';

    this.logger.debug(
      JSON.stringify({
        event: 'billing_invoice_pdf_request',
        requestId,
        workspaceId,
        billingItemId,
        userId: String(user._id),
        saveProfile,
        ...queryMeta,
      }),
    );

    const outcome = await this.billingInvoicesService.streamBillingItemPdf(
      workspaceId,
      billingItemId,
      query,
      { requestId, userId: String(user._id), saveProfile },
    );

    if (outcome.mode === 'provider_url') {
      res
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Cache-Control', 'private, no-store')
        .send({
          mode: 'provider_url',
          url: outcome.url,
          source: outcome.source,
        });
      return;
    }

    res
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${outcome.filename}"`)
      .header('Cache-Control', 'private, no-store')
      .send(outcome.buffer);
  }

  private async buildSubscriptionActionResponse(
    workspaceId: string,
    outcome: Awaited<ReturnType<BillingSubscriptionActionsService['cancelSubscription']>>,
  ) {
    const summary = await this.billingSummaryService.getSummary(workspaceId);
    return {
      action: outcome.action,
      message: outcome.message,
      summary,
      planKey: outcome.planKey,
      status: outcome.status,
      currentPeriodEnd: outcome.currentPeriodEnd,
      cancelAtPeriodEnd: outcome.cancelAtPeriodEnd,
    };
  }

  @Post(':workspaceId/billing/subscription/cancel')
  async cancelSubscription(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { confirm?: boolean },
  ) {
    await this.assertWorkspaceOwner(req, workspaceId);
    const outcome = await this.billingSubscriptionActionsService.cancelSubscription(
      workspaceId,
      Boolean(body?.confirm),
    );
    return this.buildSubscriptionActionResponse(workspaceId, outcome);
  }

  @Post(':workspaceId/billing/manage')
  async createManageBillingSession(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    await this.assertWorkspaceOwner(req, workspaceId);
    return this.billingManageService.createManageBillingUrl(workspaceId);
  }

  @Post(':workspaceId/billing/subscription/restore')
  async restoreSubscription(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceOwner(req, workspaceId);
    const outcome = await this.billingSubscriptionActionsService.restoreSubscription(workspaceId);
    return this.buildSubscriptionActionResponse(workspaceId, outcome);
  }

  @Post(':workspaceId/billing/subscription/change-plan')
  async changeSubscriptionPlan(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { planKey?: string },
  ) {
    await this.assertWorkspaceOwner(req, workspaceId);
    const outcome = await this.billingSubscriptionActionsService.changePlan(
      workspaceId,
      String(body?.planKey ?? ''),
    );
    return this.buildSubscriptionActionResponse(workspaceId, outcome);
  }

  @Post(':workspaceId/billing/addons/cancel')
  async cancelAddon(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { addonKey?: string; targetBotId?: string },
  ) {
    await this.assertWorkspaceOwner(req, workspaceId);
    const outcome = await this.billingAddonActionsService.cancelAddon(
      workspaceId,
      String(body?.addonKey ?? ''),
      body?.targetBotId ?? null,
    );
    const summary = await this.billingSummaryService.getSummary(workspaceId);
    return {
      ...outcome,
      summary,
    };
  }
}
