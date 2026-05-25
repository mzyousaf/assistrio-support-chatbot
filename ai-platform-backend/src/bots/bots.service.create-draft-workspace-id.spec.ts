import { Types } from 'mongoose';
import { BotsService } from './bots.service';

describe('BotsService.createDraft workspaceId option', () => {
  const workspaceId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const otherWorkspaceId = new Types.ObjectId('507f1f77bcf86cd799439014');
  const userId = '507f1f77bcf86cd799439012';
  const clientDraftId = 'draft-client-abc';

  function buildService() {
    const findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
    const botModel = { findOne, create: jest.fn() } as never;

    const ensurePersonalWorkspaceForUser = jest.fn().mockResolvedValue(workspaceId);
    const workspacesService = { ensurePersonalWorkspaceForUser } as never;

    const workspaceBotLimitService = {
      assertCanAddBotToWorkspace: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('../entitlements/workspace-bot-limit.service').WorkspaceBotLimitService;

    const svc = new BotsService(
      {} as never,
      botModel,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      workspacesService,
      workspaceBotLimitService,
      {} as never,
    );

    jest.spyOn(svc, 'create').mockResolvedValue({ _id: new Types.ObjectId(), slug: 'new-bot' } as never);
    jest.spyOn(svc, 'generateUniqueSlug').mockResolvedValue('new-bot');

    return { svc, ensurePersonalWorkspaceForUser, workspaceBotLimitService };
  }

  it('uses explicit workspaceId without calling ensurePersonalWorkspaceForUser', async () => {
    const { svc, ensurePersonalWorkspaceForUser, workspaceBotLimitService } = buildService();

    await svc.createDraft(clientDraftId, userId, {
      enforceWorkspaceBotLimit: true,
      workspaceId: String(otherWorkspaceId),
    });

    expect(ensurePersonalWorkspaceForUser).not.toHaveBeenCalled();
    expect(workspaceBotLimitService.assertCanAddBotToWorkspace).toHaveBeenCalledWith(String(otherWorkspaceId));
    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: otherWorkspaceId }),
    );
  });

  it('falls back to ensurePersonalWorkspaceForUser when workspaceId omitted', async () => {
    const { svc, ensurePersonalWorkspaceForUser } = buildService();

    await svc.createDraft(clientDraftId, userId, { enforceWorkspaceBotLimit: true });

    expect(ensurePersonalWorkspaceForUser).toHaveBeenCalledWith(userId);
    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: workspaceId }),
    );
  });
});
