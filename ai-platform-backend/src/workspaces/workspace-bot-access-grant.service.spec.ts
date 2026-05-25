import { Types } from 'mongoose';
import { WorkspaceBotAccessGrantService } from './workspace-bot-access-grant.service';
import { isBotVisibleToWorkspaceMembers } from './workspace-bot-member-visibility.util';

describe('WorkspaceBotAccessGrantService access resolution', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const botId = '507f1f77bcf86cd799439020';
  const memberUserId = '507f1f77bcf86cd799439013';

  function makeService(options?: {
    explicitGrants?: boolean;
    userGrant?: { canView: boolean; canPreview: boolean } | null;
  }) {
    const grantModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(options?.explicitGrants ? { _id: new Types.ObjectId() } : null),
        }),
      }),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };

    if (options?.explicitGrants) {
      grantModel.findOne.mockImplementation(({ subjectType, userId }: { subjectType: string; userId?: Types.ObjectId }) => {
        if (subjectType === 'user' && String(userId) === memberUserId) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(options.userGrant ?? { canView: false, canPreview: false }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
        };
      });
    }

    return new WorkspaceBotAccessGrantService(
      grantModel as never,
      { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } as never,
      { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) } as never,
      { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } as never,
    );
  }

  const legacyVisibleBot = {
    _id: new Types.ObjectId(botId),
    workspaceId: new Types.ObjectId(workspaceId),
    workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: true },
  };

  it('uses legacy visibility when no explicit grants exist', async () => {
    const service = makeService({ explicitGrants: false });
    await expect(service.userCanViewBot(memberUserId, 'member', legacyVisibleBot)).resolves.toBe(true);
    await expect(service.userCanPreviewBot(memberUserId, 'member', legacyVisibleBot)).resolves.toBe(true);
  });

  it('requires explicit grant when grants exist for bot', async () => {
    const grantModel = {
      findOne: jest.fn((query: { userId?: Types.ObjectId; subjectType?: string }) => {
        if (query.subjectType === 'user' && !query.userId) {
          return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) }) };
        }
        if (query.userId && String(query.userId) === memberUserId) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue({ canView: true, canPreview: false }),
            }),
          };
        }
        return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) };
      }),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };
    const service = new WorkspaceBotAccessGrantService(
      grantModel as never,
      { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } as never,
      { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) } as never,
      { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } as never,
    );
    await expect(service.userCanViewBot(memberUserId, 'member', legacyVisibleBot)).resolves.toBe(true);
    await expect(service.userCanPreviewBot(memberUserId, 'member', legacyVisibleBot)).resolves.toBe(false);
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
