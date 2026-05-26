import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../models';
import { uploadPublic } from '../../lib/s3';
import { WorkspaceEntitlementsService } from '../../entitlements/workspace-entitlements.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import type { CustomerSessionPayload } from './customer-session.payload';
import { buildCustomerSessionPayload } from './customer-session.payload';
import type { ParsedPatchCustomerProfileBody } from './customer-profile.validation';
import type { ParsedCustomerAvatarUpload } from './customer-profile-avatar.util';
import type { RequestUser } from '../shared/request-user.types';

@Injectable()
export class CustomerProfileService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly workspacesService: WorkspacesService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  async patchProfile(userId: string, patch: ParsedPatchCustomerProfileBody): Promise<CustomerSessionPayload> {
    const setDoc: Record<string, unknown> = {};

    if (patch.displayNameOverride !== undefined) {
      setDoc.displayNameOverride = patch.displayNameOverride;
    }
    if (patch.pictureOverride !== undefined) {
      setDoc.pictureOverride = patch.pictureOverride;
    }

    const links = patch.profileLinks;
    if (links) {
      if (links.linkedinUrl !== undefined) {
        setDoc['profileLinks.linkedinUrl'] = links.linkedinUrl;
      }
      if (links.calendlyUrl !== undefined) {
        setDoc['profileLinks.calendlyUrl'] = links.calendlyUrl;
      }
      if (links.websiteUrl !== undefined) {
        setDoc['profileLinks.websiteUrl'] = links.websiteUrl;
      }
      if (links.otherUrl !== undefined) {
        setDoc['profileLinks.otherUrl'] = links.otherUrl;
      }
    }

    if (Object.keys(setDoc).length > 0) {
      await this.userModel.updateOne({ _id: new Types.ObjectId(userId) }, { $set: setDoc }).exec();
    }

    const refreshed = await this.userModel.findById(userId).exec();
    if (!refreshed) {
      throw new Error('User not found');
    }

    return buildCustomerSessionPayload(
      this.toRequestUser(refreshed),
      this.workspacesService,
      this.entitlementsService,
    );
  }

  async uploadAvatar(userId: string, file: ParsedCustomerAvatarUpload): Promise<CustomerSessionPayload> {
    try {
      const uploaded = await uploadPublic({
        prefix: `uploads/customer-avatars/${userId}`,
        originalName: file.originalName,
        contentType: file.mime,
        body: file.buffer,
      });

      await this.userModel
        .updateOne({ _id: new Types.ObjectId(userId) }, { $set: { pictureOverride: uploaded.url } })
        .exec();

      const refreshed = await this.userModel.findById(userId).exec();
      if (!refreshed) {
        throw new Error('User not found');
      }

      return buildCustomerSessionPayload(
        this.toRequestUser(refreshed),
        this.workspacesService,
        this.entitlementsService,
      );
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[customer-profile] avatar upload failed', { userId, msg });
      throw new HttpException(
        { error: 'Avatar storage is not available. Try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private toRequestUser(user: User): RequestUser {
    const u = user as unknown as {
      _id: unknown;
      email: string;
      role: string;
      firstName?: string;
      lastName?: string;
      picture?: string;
      displayNameOverride?: string;
      pictureOverride?: string | null;
      profileLinks?: RequestUser['profileLinks'];
    };
    return {
      _id: u._id,
      email: u.email,
      role: u.role,
      firstName: u.firstName,
      lastName: u.lastName,
      picture: u.picture,
      displayNameOverride: u.displayNameOverride,
      pictureOverride: u.pictureOverride,
      profileLinks: u.profileLinks,
    };
  }
}
