import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceBillingProfile } from '../models/workspace-billing-profile.schema';
import type { BillingOrderInvoiceDetails } from './billing-invoice-download.types';
import {
  isCompleteBillingProfileInput,
  parseBillingProfilePatch,
  profileRecordToInvoiceDetails,
  toWorkspaceBillingProfileResponse,
} from './billing-profile.util';
import type {
  WorkspaceBillingProfileInput,
  WorkspaceBillingProfileRecord,
} from './billing-profile.types';

@Injectable()
export class BillingProfileService {
  constructor(
    @InjectModel(WorkspaceBillingProfile.name)
    private readonly profileModel: Model<WorkspaceBillingProfile>,
  ) {}

  async getProfile(workspaceId: string): Promise<WorkspaceBillingProfileRecord | null> {
    const doc = await this.findProfileDocument(workspaceId);
    if (!doc) return null;
    return toWorkspaceBillingProfileResponse(workspaceId, doc);
  }

  async hasCompleteProfile(workspaceId: string): Promise<boolean> {
    const doc = await this.findProfileDocument(workspaceId);
    if (!doc) return false;
    return isCompleteBillingProfileInput({
      name: doc.name,
      address: doc.address,
      city: doc.city,
      state: doc.state ?? undefined,
      zipCode: doc.zipCode,
      country: doc.country,
    });
  }

  async getInvoiceDetailsForOrder(workspaceId: string): Promise<BillingOrderInvoiceDetails | null> {
    const profile = await this.getProfile(workspaceId);
    if (!profile || !isCompleteBillingProfileInput(profile)) return null;
    return profileRecordToInvoiceDetails(profile);
  }

  async upsertProfile(
    workspaceId: string,
    userId: string,
    input: WorkspaceBillingProfileInput,
  ): Promise<WorkspaceBillingProfileRecord> {
    const parsed = parseBillingProfilePatch(input);
    if (!parsed.ok) {
      throw new BadRequestException({
        message: parsed.message,
        errorCode: parsed.errorCode,
      });
    }

    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException({
        message: 'Invalid workspace or user.',
        errorCode: 'billing_profile_invalid',
      });
    }

    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const userObjectId = new Types.ObjectId(userId);
    const { profile } = parsed;

    const doc = await this.profileModel
      .findOneAndUpdate(
        { workspaceId: workspaceObjectId },
        {
          workspaceId: workspaceObjectId,
          name: profile.name,
          address: profile.address,
          city: profile.city,
          state: profile.state ?? null,
          zipCode: profile.zipCode,
          country: profile.country,
          taxId: profile.taxId ?? null,
          email: profile.email ?? null,
          notes: profile.notes ?? null,
          updatedBy: userObjectId,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return toWorkspaceBillingProfileResponse(workspaceId, doc);
  }

  private async findProfileDocument(workspaceId: string) {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    return this.profileModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .lean()
      .exec();
  }
}
