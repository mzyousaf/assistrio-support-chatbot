import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceSubscription } from '../models/workspace-subscription.schema';
import {
  readAiCreditsAutoTopUpPromptEnabled,
  readAutoTopUpThresholdCredits,
} from './billing-credit-auto-topup.util';

export type BillingCreditAutoTopUpOutcome = {
  ok: true;
  autoTopUpPromptEnabled: boolean;
};

@Injectable()
export class BillingCreditAutoTopUpService {
  constructor(
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  async setAutoTopUpPromptEnabled(
    workspaceId: string,
    enabled: boolean,
  ): Promise<BillingCreditAutoTopUpOutcome> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    if (enabled) {
      const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
      if (entitlements.isTrialExpired || !entitlements.addonsAllowed) {
        throw new BadRequestException({
          error: 'Auto top-up prompts are available on active paid plans only.',
          errorCode: 'billing_credit_auto_topup_not_allowed',
        });
      }
    }

    const updated = await this.subscriptionModel
      .findOneAndUpdate(
        { workspaceId: new Types.ObjectId(workspaceId) },
        {
          $set: {
            aiCreditsAutoTopUpPromptEnabled: Boolean(enabled),
            creditAutoTopUpEnabled: false,
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException({ error: 'Workspace subscription not found.' });
    }

    return {
      ok: true,
      autoTopUpPromptEnabled: readAiCreditsAutoTopUpPromptEnabled(updated),
    };
  }
}

export function parseCreditAutoTopUpEnabledInput(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw new BadRequestException({
    error: 'enabled must be a boolean.',
    errorCode: 'billing_credit_auto_topup_invalid',
  });
}

export { readAiCreditsAutoTopUpPromptEnabled, readAutoTopUpThresholdCredits };
