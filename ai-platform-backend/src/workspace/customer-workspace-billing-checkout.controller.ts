import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BillingCheckoutService } from '../billing/billing-checkout.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceBillingCheckoutController {
  constructor(
    private readonly billingCheckoutService: BillingCheckoutService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private async assertWorkspaceOwner(req: RequestWithUser, workspaceId: string): Promise<RequestUser> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }
    await this.workspacesService.assertWorkspaceOwner(String(user._id), workspaceId);
    return user;
  }

  @Post(':workspaceId/billing/checkout/plan')
  async checkoutPlan(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { planKey?: string },
  ) {
    const user = await this.assertWorkspaceOwner(req, workspaceId);
    return this.billingCheckoutService.createPlanCheckout(workspaceId, String(user._id), String(body?.planKey ?? ''));
  }

  @Post(':workspaceId/billing/checkout/addon')
  async checkoutAddon(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { addonKey?: string; targetBotId?: string },
  ) {
    const user = await this.assertWorkspaceOwner(req, workspaceId);
    return this.billingCheckoutService.createAddonCheckout(
      workspaceId,
      String(user._id),
      String(body?.addonKey ?? ''),
    );
  }

  @Post(':workspaceId/billing/checkout/top-up')
  async checkoutTopUp(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { topUpKey?: string },
  ) {
    const user = await this.assertWorkspaceOwner(req, workspaceId);
    return this.billingCheckoutService.createTopUpCheckout(
      workspaceId,
      String(user._id),
      String(body?.topUpKey ?? ''),
    );
  }
}
