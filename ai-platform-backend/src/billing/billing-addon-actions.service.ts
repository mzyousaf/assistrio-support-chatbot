import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { WORKSPACE_ADDON_CATALOG } from '../entitlements/addon-catalog';
import { BillingProviderService } from './billing-provider.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import {
  BillingProviderActionError,
  isBillingAddonCheckoutKey,
  type BillingAddonCheckoutKey,
} from './billing-provider.types';

export type BillingAddonCancelOutcome = {
  ok: true;
  message: string;
  addonKey: BillingAddonCheckoutKey;
  addonInstanceId?: string;
  targetBotId?: string | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
};

@Injectable()
export class BillingAddonActionsService {
  constructor(
    @InjectModel(WorkspaceAddon.name)
    private readonly addonModel: Model<WorkspaceAddon>,
    private readonly billingProviderService: BillingProviderService,
    private readonly webhookProcessingService: BillingWebhookProcessingService,
  ) {}

  private assertBillingConfigured(): void {
    if (!this.billingProviderService.isCheckoutConfigured()) {
      throw new ServiceUnavailableException({
        error: 'Billing provider is not configured.',
        errorCode: 'billing_provider_not_configured',
      });
    }
  }

  private mapProviderError(err: unknown): never {
    if (err instanceof BillingProviderActionError) {
      throw new BadRequestException({
        error: err.message,
        errorCode: err.errorCode,
      });
    }
    throw err;
  }

  private assertRecurringAddonCatalog(addonKey: string) {
    const catalog = WORKSPACE_ADDON_CATALOG.find((item) => item.key === addonKey);
    if (!catalog || catalog.billingInterval !== 'monthly') {
      throw new BadRequestException({
        error: 'One-time purchases cannot be cancelled.',
        errorCode: 'billing_addon_cancel_not_allowed',
      });
    }
    return catalog;
  }

  async cancelAddonByInstanceId(
    workspaceId: string,
    addonInstanceId: string,
    now: Date = new Date(),
  ): Promise<BillingAddonCancelOutcome> {
    this.assertBillingConfigured();

    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(addonInstanceId)) {
      throw new NotFoundException({ error: 'Active add-on not found.' });
    }

    const addon = await this.addonModel
      .findOne({
        _id: new Types.ObjectId(addonInstanceId),
        workspaceId: new Types.ObjectId(workspaceId),
        status: 'active',
      })
      .lean()
      .exec();

    if (!addon) {
      throw new NotFoundException({
        error: 'Active add-on not found.',
        errorCode: 'billing_addon_not_found',
      });
    }

    if (!isBillingAddonCheckoutKey(String(addon.addonKey))) {
      throw new BadRequestException({
        error: 'Only recurring add-ons can be cancelled.',
        errorCode: 'billing_addon_cancel_not_allowed',
      });
    }

    this.assertRecurringAddonCatalog(String(addon.addonKey));

    return this.cancelAddonDocument(addon, workspaceId, now);
  }

  async cancelAddon(
    workspaceId: string,
    addonKey: string,
    targetBotId?: string | null,
    now: Date = new Date(),
  ): Promise<BillingAddonCancelOutcome> {
    this.assertBillingConfigured();

    if (!isBillingAddonCheckoutKey(addonKey)) {
      throw new BadRequestException({
        error: 'Only recurring add-ons can be cancelled.',
        errorCode: 'billing_addon_cancel_not_allowed',
      });
    }

    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    this.assertRecurringAddonCatalog(addonKey);

    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const normalizedTargetBotId =
      targetBotId && Types.ObjectId.isValid(targetBotId) ? new Types.ObjectId(targetBotId) : null;

    const addon = await this.addonModel
      .findOne({
        workspaceId: workspaceObjectId,
        addonKey,
        targetBotId: normalizedTargetBotId,
        status: 'active',
      })
      .lean()
      .exec();

    if (!addon) {
      throw new NotFoundException({
        error: 'Active add-on not found.',
        errorCode: 'billing_addon_not_found',
      });
    }

    return this.cancelAddonDocument(addon, workspaceId, now);
  }

  private async cancelAddonDocument(
    addon: {
      _id: Types.ObjectId;
      addonKey: string;
      targetBotId?: Types.ObjectId | null;
      status: string;
      providerSubscriptionId?: string | null;
      cancelAtPeriodEnd?: boolean;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      scheduledIntervalChange?: {
        fromBillingInterval: string;
        toBillingInterval: string;
        effectiveAt: Date | string;
        status: 'scheduled' | 'applied' | 'canceled';
      } | null;
    },
    workspaceId: string,
    now: Date,
  ): Promise<BillingAddonCancelOutcome> {
    const addonKey = String(addon.addonKey) as BillingAddonCheckoutKey;
    const normalizedTargetBotId = addon.targetBotId ? String(addon.targetBotId) : null;
    const addonInstanceId = String(addon._id);

    const providerSubscriptionId = addon.providerSubscriptionId?.trim() ?? '';
    if (!providerSubscriptionId) {
      throw new BadRequestException({
        error: 'Add-on is not linked to a billing provider subscription.',
        errorCode: 'billing_addon_cancel_not_allowed',
      });
    }

    if (addon.cancelAtPeriodEnd) {
      return {
        ok: true,
        message: 'Add-on cancellation is already scheduled.',
        addonKey,
        addonInstanceId,
        targetBotId: normalizedTargetBotId,
        currentPeriodEnd: addon.currentPeriodEnd?.toISOString(),
        cancelAtPeriodEnd: true,
      };
    }

    if (addon.scheduledIntervalChange?.status === 'scheduled') {
      await this.addonModel.updateOne(
        { _id: addon._id },
        {
          $set: {
            scheduledIntervalChange: {
              ...addon.scheduledIntervalChange,
              status: 'canceled',
            },
          },
        },
      );
    }

    try {
      const remote = await this.billingProviderService.cancelSubscription({
        providerSubscriptionId,
      });

      await this.webhookProcessingService.applyAction(
        {
          kind: 'addon_sync',
          workspaceId,
          addonKey,
          targetBotId: normalizedTargetBotId ?? undefined,
          status: 'active',
          providerSubscriptionId,
          currentPeriodStart: remote.currentPeriodStart ?? addon.currentPeriodStart ?? undefined,
          currentPeriodEnd: remote.currentPeriodEnd ?? addon.currentPeriodEnd ?? undefined,
          cancelAtPeriodEnd: true,
        },
        now,
      );
    } catch (err) {
      this.mapProviderError(err);
    }

    const updated = await this.addonModel.findById(addon._id);
    const periodEnd = updated?.currentPeriodEnd ?? addon.currentPeriodEnd;
    return {
      ok: true,
      message:
        'Add-on cancellation scheduled. It remains active until the end of the current billing period.',
      addonKey,
      addonInstanceId,
      targetBotId: normalizedTargetBotId,
      currentPeriodEnd: periodEnd?.toISOString(),
      cancelAtPeriodEnd: true,
    };
  }
}
