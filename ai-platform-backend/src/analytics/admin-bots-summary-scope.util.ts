import { NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { Bot, User, WorkspaceMembership } from '../models';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import { accessibleBotsMatchForCustomer } from '../admin-customers/admin-customers.util';
import type { AdminAnalyticsScope } from './admin-bots-summary-query.util';

/** Platform-owned bots (`isPlatformBot` only — matches admin platform bots list). */
export function platformBotsMatchClause(): Record<string, unknown> {
  return { isPlatformBot: true };
}

/** Tenant/customer workspace bots (excludes platform-owned rows). */
export function customerTenantBotsMatchClause(): Record<string, unknown> {
  return {
    $or: [{ isPlatformBot: { $ne: true } }, { isPlatformBot: { $exists: false } }],
  };
}

/** When filter is non-empty, load matching bot ids; `null` means no scope restriction (legacy all-bots). */
export async function listBotIdsForAnalyticsFilter(
  botModel: Model<Bot>,
  filter: Record<string, unknown>,
): Promise<Types.ObjectId[] | null> {
  if (!filter || Object.keys(filter).length === 0) {
    return null;
  }
  const docs = await botModel.find(filter).select('_id').lean();
  return (docs as { _id: Types.ObjectId }[]).map((d) => d._id);
}

async function workspaceIdsForUser(
  membershipModel: Model<WorkspaceMembership>,
  userId: Types.ObjectId,
): Promise<Types.ObjectId[]> {
  const rows = await membershipModel.find({ userId }).select('workspaceId').lean();
  return (rows as { workspaceId: Types.ObjectId }[])
    .map((r) => r.workspaceId)
    .filter((id) => id != null);
}

async function customerBotsMatchForId(
  userModel: Model<User>,
  membershipModel: Model<WorkspaceMembership>,
  customerIdRaw: string,
): Promise<Record<string, unknown>> {
  if (!Types.ObjectId.isValid(customerIdRaw)) {
    throw new NotFoundException({ error: 'Customer not found' });
  }
  const customerId = new Types.ObjectId(customerIdRaw);
  const doc = await userModel.findOne({ _id: customerId, role: 'customer' }).lean();
  if (!doc) {
    throw new NotFoundException({ error: 'Customer not found' });
  }
  const workspaceIds = await workspaceIdsForUser(membershipModel, customerId);
  return {
    $and: [botNotDeletedClause(), accessibleBotsMatchForCustomer(customerId, workspaceIds)],
  };
}

export type ResolveBotsSummaryBotFindFilterParams = {
  scope: AdminAnalyticsScope;
  customerId?: string;
  userModel: Model<User>;
  membershipModel: Model<WorkspaceMembership>;
};

/**
 * Mongo filter for `Bot.find`. Empty object when `scope` is `all` and no `customerId` (legacy behavior).
 */
export async function resolveBotsSummaryBotFindFilter(
  params: ResolveBotsSummaryBotFindFilterParams,
): Promise<Record<string, unknown>> {
  const { scope, customerId, userModel, membershipModel } = params;

  if (customerId?.trim()) {
    return customerBotsMatchForId(userModel, membershipModel, customerId.trim());
  }

  if (scope === 'all') {
    return {};
  }

  if (scope === 'platform') {
    return { $and: [botNotDeletedClause(), platformBotsMatchClause()] };
  }

  return { $and: [botNotDeletedClause(), customerTenantBotsMatchClause()] };
}
