import { Types } from 'mongoose';

type BotOwnershipSource = {
  isPlatformBot?: boolean;
  agentsPackAgent?: boolean;
  platformBotType?: 'landing_demo' | 'showcase' | 'support' | 'internal' | null;
  workspaceId?: Types.ObjectId | string | null;
  ownerId?: Types.ObjectId | string | null;
  createdByUserId?: Types.ObjectId | string | null;
};

/** Safe admin-facing ownership fields for analytics bot rows. */
export function adminAnalyticsBotOwnershipFields(b: BotOwnershipSource) {
  const isPlatformBot = Boolean(b.isPlatformBot);
  const platformBotType =
    b.platformBotType === 'landing_demo' ||
    b.platformBotType === 'showcase' ||
    b.platformBotType === 'support' ||
    b.platformBotType === 'internal'
      ? b.platformBotType
      : null;

  return {
    isPlatformBot,
    platformBotType: isPlatformBot ? platformBotType : null,
    workspaceId: b.workspaceId != null ? String(b.workspaceId) : null,
    ownerId: b.ownerId != null ? String(b.ownerId) : null,
  };
}
