import { Types } from 'mongoose';
import { legacyOnboardingDraftBotArchiveFilter } from './legacy-onboarding-draft-bot.util';

describe('legacyOnboardingDraftBotArchiveFilter', () => {
  const workspaceId = new Types.ObjectId();

  it('matches draft bots with clientDraftId in the workspace', () => {
    const filter = legacyOnboardingDraftBotArchiveFilter(workspaceId);
    expect(filter).toMatchObject({
      workspaceId,
      status: 'draft',
      clientDraftId: { $exists: true, $type: 'string', $nin: [null, ''] },
    });
  });

  it('excludes a preserved bot id when provided', () => {
    const preserveId = new Types.ObjectId().toString();
    const filter = legacyOnboardingDraftBotArchiveFilter(workspaceId, { excludeBotId: preserveId });
    expect(filter._id).toEqual({ $ne: new Types.ObjectId(preserveId) });
  });

  it('does not match published bots (status draft required)', () => {
    const filter = legacyOnboardingDraftBotArchiveFilter(workspaceId);
    expect(filter.status).toBe('draft');
  });
});
