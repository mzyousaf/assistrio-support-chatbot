import { Types } from 'mongoose';
import { BotsService } from './bots.service';

describe('BotsService.findForCustomerWorkspaceList', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function buildService(findResult: unknown[]) {
    const lean = jest.fn().mockResolvedValue(findResult);
    const select = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ select });
    const find = jest.fn().mockReturnValue({ sort });
    const botModel = { find } as never;

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
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { svc, find };
  }

  it('filters by workspaceId and excludes legacy null-workspace bots by query shape', async () => {
    const botInWorkspace = {
      _id: new Types.ObjectId(),
      workspaceId: new Types.ObjectId(workspaceId),
      name: 'Scoped bot',
      status: 'published',
    };
    const { svc, find } = buildService([botInWorkspace]);

    const rows = await svc.findForCustomerWorkspaceList('all', workspaceId);

    expect(rows).toEqual([botInWorkspace]);
    const query = find.mock.calls[0][0] as { $and: Record<string, unknown>[] };
    expect(query.$and[0]).toEqual({ workspaceId: new Types.ObjectId(workspaceId) });
    expect(query.$and).toHaveLength(2);
  });

  it('applies status filter with workspace scope', async () => {
    const { svc, find } = buildService([]);

    await svc.findForCustomerWorkspaceList('draft', workspaceId);

    const query = find.mock.calls[0][0] as { $and: Record<string, unknown>[] };
    expect(query.$and[0]).toEqual({
      workspaceId: new Types.ObjectId(workspaceId),
      status: 'draft',
    });
  });

  it('returns empty array for invalid workspaceId', async () => {
    const { svc, find } = buildService([]);

    const rows = await svc.findForCustomerWorkspaceList('all', 'not-an-id');

    expect(rows).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});
