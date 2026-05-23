import { Types } from 'mongoose';
import { workspaceCustomerBotCountFilter } from '../entitlements/workspace-bot-limit.service';

/**
 * Mongo filter for old bot-first onboarding drafts that should be archived before botless go-live.
 * Only matches non-deleted workspace draft bots with a persisted {@link Bot.clientDraftId}.
 */
export function legacyOnboardingDraftBotArchiveFilter(
  workspaceId: string | Types.ObjectId,
  options?: { excludeBotId?: string | null },
): Record<string, unknown> {
  const wsOid =
    workspaceId instanceof Types.ObjectId ? workspaceId : new Types.ObjectId(String(workspaceId));
  const preserve = String(options?.excludeBotId ?? '').trim();
  return {
    ...workspaceCustomerBotCountFilter(wsOid),
    status: 'draft',
    clientDraftId: { $exists: true, $type: 'string', $nin: [null, ''] },
    ...(preserve && Types.ObjectId.isValid(preserve) ? { _id: { $ne: new Types.ObjectId(preserve) } } : {}),
  };
}
