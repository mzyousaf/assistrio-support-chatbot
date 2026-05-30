import { Injectable, NotFoundException } from '@nestjs/common';
import type { BillingCustomerPortalResult } from './billing-provider.types';
import { BillingProviderService } from './billing-provider.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';

@Injectable()
export class BillingManageService {
  constructor(
    private readonly billingProviderService: BillingProviderService,
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
  ) {}

  async createManageBillingUrl(workspaceId: string): Promise<BillingCustomerPortalResult> {
    if (!this.billingProviderService.isCheckoutConfigured()) {
      throw new NotFoundException({
        error: 'Billing portal is not available.',
        errorCode: 'billing_portal_not_available',
      });
    }

    const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const providerSubscriptionId = subscription?.providerSubscriptionId?.trim() ?? '';
    if (!providerSubscriptionId) {
      throw new NotFoundException({
        error: 'Billing portal is not available for this workspace.',
        errorCode: 'billing_portal_not_available',
      });
    }

    const portal = await this.billingProviderService.getCustomerPortalUrl({
      providerSubscriptionId,
    });

    if (!portal?.url?.trim()) {
      throw new NotFoundException({
        error: 'Billing portal is not available for this workspace.',
        errorCode: 'billing_portal_not_available',
      });
    }

    return portal;
  }
}
