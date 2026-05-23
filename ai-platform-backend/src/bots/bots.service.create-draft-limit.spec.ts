import { Types } from 'mongoose';
import { BotsService } from './bots.service';
import type { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';

describe('BotsService.createDraft workspace bot limit', () => {
  const workspaceId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const userId = '507f1f77bcf86cd799439012';
  const clientDraftId = 'draft-client-abc';

  function buildService(overrides: {
    existingDraft?: { _id: Types.ObjectId; slug: string } | null;
    assertCanAdd?: jest.Mock;
  }) {
    const findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(overrides.existingDraft ?? null),
      }),
    });
    const botModel = {
      findOne,
      create: jest.fn(),
    } as never;

    const workspacesService = {
      ensurePersonalWorkspaceForUser: jest.fn().mockResolvedValue(workspaceId),
    } as never;

    const workspaceBotLimitService = {
      assertCanAddBotToWorkspace: overrides.assertCanAdd ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceBotLimitService;

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

    return { svc, workspaceBotLimitService, findOne, botModel };
  }

  it('allows first draft when enforceWorkspaceBotLimit is true and workspace is empty', async () => {
    const assertCanAdd = jest.fn().mockResolvedValue(undefined);
    const { svc, workspaceBotLimitService } = buildService({ assertCanAdd });

    const result = await svc.createDraft(clientDraftId, userId, { enforceWorkspaceBotLimit: true });

    expect(workspaceBotLimitService.assertCanAddBotToWorkspace).toHaveBeenCalledWith(String(workspaceId));
    expect(result.slug).toBe('new-bot');
  });

  it('blocks second new draft when workspace is at limit', async () => {
    const assertCanAdd = jest.fn().mockRejectedValue(new Error('plan limit'));
    const { svc } = buildService({ assertCanAdd });

    await expect(
      svc.createDraft('another-draft-id', userId, { enforceWorkspaceBotLimit: true }),
    ).rejects.toThrow('plan limit');
  });

  it('resumes existing draft without checking bot limit', async () => {
    const existing = { _id: new Types.ObjectId(), slug: 'existing-slug' };
    const assertCanAdd = jest.fn();
    const { svc, workspaceBotLimitService } = buildService({ existingDraft: existing, assertCanAdd });

    const result = await svc.createDraft(clientDraftId, userId, { enforceWorkspaceBotLimit: true });

    expect(result).toEqual({ botId: String(existing._id), slug: 'existing-slug' });
    expect(workspaceBotLimitService.assertCanAddBotToWorkspace).not.toHaveBeenCalled();
  });

  it('does not enforce limit when enforceWorkspaceBotLimit is false', async () => {
    const assertCanAdd = jest.fn();
    const { svc, workspaceBotLimitService } = buildService({ assertCanAdd });

    await svc.createDraft(clientDraftId, userId);

    expect(workspaceBotLimitService.assertCanAddBotToWorkspace).not.toHaveBeenCalled();
  });
});
