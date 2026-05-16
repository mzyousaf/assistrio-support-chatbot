import { KnowledgeBaseItemService } from './knowledge-base-item.service';

describe('KnowledgeBaseItemService.setKnowledgeItemActiveById', () => {
  it('delegates to access service and refreshes stats on success', async () => {
    const access = { setKnowledgeItemActiveById: jest.fn().mockResolvedValue(true) };
    const refresh = jest.fn().mockResolvedValue(undefined);
    const svc = Object.create(KnowledgeBaseItemService.prototype) as {
      setKnowledgeItemActiveById: KnowledgeBaseItemService['setKnowledgeItemActiveById'];
      knowledgeBaseItemAccess: typeof access;
      refreshBotKnowledgeStats: typeof refresh;
    };
    svc.knowledgeBaseItemAccess = access;
    svc.refreshBotKnowledgeStats = refresh;

    const ok = await svc.setKnowledgeItemActiveById(
      '665f8dd44f6f58de4012ab12',
      '665f8dd44f6f58de4012ab13',
      false,
    );

    expect(ok).toBe(true);
    expect(access.setKnowledgeItemActiveById).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh stats when no row matched', async () => {
    const access = { setKnowledgeItemActiveById: jest.fn().mockResolvedValue(false) };
    const refresh = jest.fn().mockResolvedValue(undefined);
    const svc = Object.create(KnowledgeBaseItemService.prototype) as {
      setKnowledgeItemActiveById: KnowledgeBaseItemService['setKnowledgeItemActiveById'];
      knowledgeBaseItemAccess: typeof access;
      refreshBotKnowledgeStats: typeof refresh;
    };
    svc.knowledgeBaseItemAccess = access;
    svc.refreshBotKnowledgeStats = refresh;

    const ok = await svc.setKnowledgeItemActiveById(
      '665f8dd44f6f58de4012ab12',
      '665f8dd44f6f58de4012ab13',
      true,
    );

    expect(ok).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
