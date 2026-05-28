import { Types } from 'mongoose';
import { WorkspaceBotAccessGrantService } from './workspace-bot-access-grant.service';
import { isBotVisibleToWorkspaceMembers } from './workspace-bot-member-visibility.util';

describe('WorkspaceBotAccessGrantService access resolution', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const botId = '507f1f77bcf86cd799439020';
  const memberUserId = '507f1f77bcf86cd799439013';

  function makeService(options?: {
    userGrant?: { canView: boolean; canPreview: boolean } | null;
  }) {
    const grantModel = {
      findOne: jest.fn(({ subjectType, userId }: { subjectType: string; userId?: Types.ObjectId }) => {
        if (subjectType === 'user' && userId && String(userId) === memberUserId) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(options?.userGrant ?? null),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
        };
      }),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };

    return new WorkspaceBotAccessGrantService(
      grantModel as never,
      { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } as never,
      { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) } as never,
      { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) } as never,
      { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } as never,
    );
  }

  const workspaceBot = {
    _id: new Types.ObjectId(botId),
    workspaceId: new Types.ObjectId(workspaceId),
    workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: true },
  };

  it('denies workspace bot access without per-person grant', async () => {
    const service = makeService();
    await expect(service.userCanViewBot(memberUserId, 'member', workspaceBot)).resolves.toBe(false);
    await expect(service.userCanPreviewBot(memberUserId, 'member', workspaceBot)).resolves.toBe(false);
  });

  it('allows workspace member with canView grant but blocks preview without canPreview', async () => {
    const service = makeService({ userGrant: { canView: true, canPreview: false } });
    await expect(service.userCanViewBot(memberUserId, 'member', workspaceBot)).resolves.toBe(true);
    await expect(service.userCanPreviewBot(memberUserId, 'member', workspaceBot)).resolves.toBe(false);
  });

  it('allows workspace owner full access regardless of grants', async () => {
    const service = makeService();
    await expect(service.userCanViewBot(memberUserId, 'owner', workspaceBot)).resolves.toBe(true);
    await expect(service.userCanPreviewBot(memberUserId, 'owner', workspaceBot)).resolves.toBe(true);
  });

  it('uses legacy visibility for non-workspace bots', async () => {
    const personalBot = {
      _id: new Types.ObjectId(botId),
      workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: true },
    };
    const service = makeService();
    await expect(service.userCanViewBot(memberUserId, 'member', personalBot)).resolves.toBe(true);
    await expect(service.userCanPreviewBot(memberUserId, 'member', personalBot)).resolves.toBe(true);
  });

  it('forces canPreview to require canView in legacy helper', () => {
    const service = makeService();
    expect(service.legacyMemberAccess({
      workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: true },
    })).toEqual({ canView: true, canPreview: true });
    expect(isBotVisibleToWorkspaceMembers({ workspaceMemberVisibility: { visibleToMembers: false } })).toBe(false);
  });
});

describe('WorkspacesService assertCanAccessWorkspaceBot code', () => {
  it('exports workspace_bot_access_denied constants', () => {
    const util = require('./workspace-bot-access-grant.util');
    expect(util.WORKSPACE_BOT_ACCESS_DENIED_CODE).toBe('workspace_bot_access_denied');
  });
});
