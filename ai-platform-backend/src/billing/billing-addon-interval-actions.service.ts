import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { isRecurringWorkspaceAddonKey } from '../entitlements/addon-catalog';
import { parseBillingInterval, isBillingInterval, type BillingInterval } from './billing-interval.types';
import { BillingProviderService } from './billing-provider.service';
import {
  BillingProviderActionError,
  isBillingAddonCheckoutKey,
  type BillingAddonCheckoutKey,
} from './billing-provider.types';
import {
  readScheduledIntervalChange,
} from '../entitlements/workspace-scheduled-interval-change.util';

export type BillingAddonIntervalActionOutcome = {
  ok: true;
  message: string;
  addonInstanceId: string;
  addonKey: BillingAddonCheckoutKey;
  billingInterval: BillingInterval;
  scheduledBillingInterval?: BillingInterval;
  scheduledEffectiveAt?: string;
};

@Injectable()
export class BillingAddonIntervalActionsService {
  constructor(
    @InjectModel(WorkspaceAddon.name)
    private readonly addonModel: Model<WorkspaceAddon>,
    private readonly billingProviderService: BillingProviderService,
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

  private async loadActiveAddonInstance(workspaceId: string, addonInstanceId: string) {
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

    const addonKey = String(addon.addonKey ?? '').trim();
    if (!isBillingAddonCheckoutKey(addonKey) || !isRecurringWorkspaceAddonKey(addonKey)) {
      throw new BadRequestException({
        error: 'Only recurring add-ons support billing interval changes.',
        errorCode: 'billing_addon_interval_not_allowed',
      });
    }

    const providerSubscriptionId = addon.providerSubscriptionId?.trim() ?? '';
    if (!providerSubscriptionId || addon.provider !== 'lemon_squeezy') {
      throw new BadRequestException({
        error: 'No billing provider subscription is linked to this add-on.',
        errorCode: 'billing_addon_provider_subscription_missing',
      });
    }

    return { addon, addonKey: addonKey as BillingAddonCheckoutKey, providerSubscriptionId };
  }

  async scheduleAddonBillingIntervalChange(
    workspaceId: string,
    addonInstanceId: string,
    billingInterval: BillingInterval,
    now: Date = new Date(),
  ): Promise<BillingAddonIntervalActionOutcome> {
    this.assertBillingConfigured();

    if (!isBillingInterval(billingInterval)) {
      throw new BadRequestException({
        error: 'Invalid billing interval.',
        errorCode: 'invalid_billing_interval',
      });
    }

    const { addon, addonKey, providerSubscriptionId } = await this.loadActiveAddonInstance(
      workspaceId,
      addonInstanceId,
    );
    const currentBillingInterval = parseBillingInterval(addon.billingInterval);
    if (currentBillingInterval === billingInterval) {
      throw new BadRequestException({
        error: 'Add-on is already on this billing interval.',
        errorCode: 'billing_interval_already_active',
      });
    }

    const effectiveAt = addon.currentPeriodEnd ?? now;

    try {
      await this.billingProviderService.changeAddonBillingInterval({
        providerSubscriptionId,
        addonKey,
        billingInterval,
        disableProrations: true,
      });
    } catch (err) {
      this.mapProviderError(err);
    }

    await this.addonModel.updateOne(
      { _id: addon._id },
      {
        $set: {
          scheduledIntervalChange: {
            fromBillingInterval: currentBillingInterval,
            toBillingInterval: billingInterval,
            effectiveAt,
            status: 'scheduled',
          },
        },
      },
    );

    return {
      ok: true,
      message: `Add-on billing interval change scheduled for ${effectiveAt.toISOString()}.`,
      addonInstanceId,
      addonKey,
      billingInterval: currentBillingInterval,
      scheduledBillingInterval: billingInterval,
      scheduledEffectiveAt: effectiveAt.toISOString(),
    };
  }

  async cancelScheduledAddonIntervalChange(
    workspaceId: string,
    addonInstanceId: string,
    now: Date = new Date(),
  ): Promise<BillingAddonIntervalActionOutcome> {
    this.assertBillingConfigured();

    const { addon, addonKey, providerSubscriptionId } = await this.loadActiveAddonInstance(
      workspaceId,
      addonInstanceId,
    );
    const scheduled = readScheduledIntervalChange(addon.scheduledIntervalChange ?? null);
    if (!scheduled || scheduled.status !== 'scheduled') {
      throw new BadRequestException({
        error: 'No scheduled add-on interval change is active.',
        errorCode: 'billing_no_scheduled_addon_interval_change',
      });
    }

    try {
      await this.billingProviderService.changeAddonBillingInterval({
        providerSubscriptionId,
        addonKey,
        billingInterval: scheduled.fromBillingInterval,
        disableProrations: true,
      });
    } catch (err) {
      this.mapProviderError(err);
    }

    await this.addonModel.updateOne(
      { _id: addon._id },
      {
        $set: {
          scheduledIntervalChange: {
            ...scheduled,
            effectiveAt:
              scheduled.effectiveAt instanceof Date
                ? scheduled.effectiveAt
                : new Date(scheduled.effectiveAt),
            status: 'canceled',
          },
        },
      },
    );

    return {
      ok: true,
      message: 'Scheduled add-on billing interval change canceled.',
      addonInstanceId,
      addonKey,
      billingInterval: parseBillingInterval(addon.billingInterval),
    };
  }
}
