import { Types } from 'mongoose';
import { WorkspacesService } from './workspaces.service';
import {
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
} from './workspace-bot-member-visibility.util';
import { WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE } from './workspace-bot-manage.constants';
import { isBotMemberPreviewAllowed, isBotVisibleToWorkspaceMembers } from './workspace-bot-member-visibility.util';
import { isWorkspaceOwnerRole } from '../models/workspace-membership-role.util';

describe('WorkspacesService member bot visibility', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439010';
  const adminUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';

  function makeService(roleByUserId: Record<string, string>, userGrants?: Record<string, { canView: boolean; canPreview: boolean }>) {
    const membershipModel = {
      findOne: jest.fn(({ userId }: { userId: Types.ObjectId }) => ({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(() => {
            const role = roleByUserId[String(userId)];
            return role ? { _id: new Types.ObjectId(), role } : null;
          }),
        }),
      })),
    };

    membershipModel.findOne.mockImplementation(({ userId }: { userId: Types.ObjectId }) => {
      const role = roleByUserId[String(userId)];
      return {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(role ? { _id: new Types.ObjectId(), role } : null),
        }),
      };
    });

    const grantService = {
      userCanViewBot: jest.fn(async (userId: string, memberRole: string | null, bot: Record<string, unknown>) => {
        if (memberRole != null && isWorkspaceOwnerRole(memberRole)) return true;
        const ws = bot.workspaceId;
        if (ws != null && String(ws).length > 0) {
          return userGrants?.[userId]?.canView === true;
        }
        return isBotVisibleToWorkspaceMembers(bot);
      }),
      userCanPreviewBot: jest.fn(async (userId: string, memberRole: string | null, bot: Record<string, unknown>) => {
        if (memberRole != null && isWorkspaceOwnerRole(memberRole)) return true;
        const ws = bot.workspaceId;
        if (ws != null && String(ws).length > 0) {
          const g = userGrants?.[userId];
          return g?.canPreview === true && g?.canView === true;
        }
        return isBotVisibleToWorkspaceMembers(bot) && isBotMemberPreviewAllowed(bot);
      }),
      filterBotsForUser: jest.fn(async (userId: string, memberRole: string | null, bots: Record<string, unknown>[]) => {
        const out: Record<string, unknown>[] = [];
        for (const bot of bots) {
          if (memberRole != null && isWorkspaceOwnerRole(memberRole)) {
            out.push(bot);
            continue;
          }
          const ws = bot.workspaceId;
          if (ws != null && String(ws).length > 0) {
            if (userGrants?.[userId]?.canView) out.push(bot);
          } else if (isBotVisibleToWorkspaceMembers(bot)) {
            out.push(bot);
          }
        }
        return out;
      }),
    };

    const workspaceModel = {
      findById: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue({ deletedAt: null }),
        })),
      })),
    };

    const service = new WorkspacesService(
      {} as never,
      workspaceModel as never,
      membershipModel as never,
      {} as never,
      {} as never,
      grantService as never,
    );

    return { service };
  }

  const visibleBot = {
    workspaceId: new Types.ObjectId(workspaceId),
    workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: true },
  };

  const hiddenBot = {
    workspaceId: new Types.ObjectId(workspaceId),
    workspaceMemberVisibility: { visibleToMembers: false, allowMemberPreview: false },
  };

  const viewOnlyBot = {
    workspaceId: new Types.ObjectId(workspaceId),
    workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: false },
  };

  it('allows workspace owner to access and preview any bot', async () => {
    const { service } = makeService({ [ownerUserId]: 'owner' });
    await expect(service.canUserAccessWorkspaceBot(ownerUserId, 'customer', hiddenBot)).resolves.toBe(true);
    await expect(service.canUserPreviewWorkspaceBot(ownerUserId, 'customer', viewOnlyBot)).resolves.toBe(true);
  });

  it('allows admin with canView grant to access bot', async () => {
    const { service } = makeService(
      { [adminUserId]: 'admin' },
      { [adminUserId]: { canView: true, canPreview: false } },
    );
    await expect(service.canUserAccessWorkspaceBot(adminUserId, 'customer', hiddenBot)).resolves.toBe(true);
    await expect(service.canUserPreviewWorkspaceBot(adminUserId, 'customer', viewOnlyBot)).resolves.toBe(false);
  });

  it('blocks member without grant from bot access even when legacy visibility is true', async () => {
    const { service } = makeService({ [memberUserId]: 'member' });
    await expect(service.canUserAccessWorkspaceBot(memberUserId, 'customer', visibleBot)).resolves.toBe(false);
    await expect(service.canUserAccessWorkspaceBot(memberUserId, 'customer', hiddenBot)).resolves.toBe(false);
  });

  it('allows member with canView grant to access bot but not preview when canPreview is false', async () => {
    const { service } = makeService(
      { [memberUserId]: 'member' },
      { [memberUserId]: { canView: true, canPreview: false } },
    );
    await expect(service.canUserAccessWorkspaceBot(memberUserId, 'customer', viewOnlyBot)).resolves.toBe(true);
    await expect(service.canUserPreviewWorkspaceBot(memberUserId, 'customer', viewOnlyBot)).resolves.toBe(false);
  });

  it('allows member preview when canView and canPreview grants are set', async () => {
    const { service } = makeService(
      { [memberUserId]: 'member' },
      { [memberUserId]: { canView: true, canPreview: true } },
    );
    await expect(service.canUserPreviewWorkspaceBot(memberUserId, 'customer', visibleBot)).resolves.toBe(true);
  });

  it('assertCanPreviewWorkspaceBot throws workspace_bot_preview_access_denied', async () => {
    const { service } = makeService(
      { [memberUserId]: 'member' },
      { [memberUserId]: { canView: true, canPreview: false } },
    );
    await expect(
      service.assertCanPreviewWorkspaceBot(memberUserId, 'customer', viewOnlyBot),
    ).rejects.toMatchObject({
      response: {
        errorCode: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
        message: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
      },
    });
  });

  it('assertCanManageWorkspaceBot still uses workspace_admin_required for members', async () => {
    const { service } = makeService(
      { [memberUserId]: 'member' },
      { [memberUserId]: { canView: true, canPreview: true } },
    );
    await expect(
      service.assertCanManageWorkspaceBot(memberUserId, 'customer', visibleBot),
    ).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE },
    });
  });
});
