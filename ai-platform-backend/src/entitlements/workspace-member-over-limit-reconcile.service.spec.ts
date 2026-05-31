import { Types } from 'mongoose';
import { WorkspaceMemberOverLimitReconcileService } from './workspace-member-over-limit-reconcile.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('WorkspaceMemberOverLimitReconcileService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createHarness(
    rows: Array<{
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      role: string;
      status?: string;
    }>,
    memberLimit: number,
  ) {
    const store = rows.map((row) => ({ ...row, status: row.status ?? 'active' }));

    const membershipModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn(async () => store),
          })),
        })),
      })),
      updateOne: jest.fn(async (filter: { _id: Types.ObjectId }, update: { $set: { status: string } }) => {
        const idx = store.findIndex((row) => String(row._id) === String(filter._id));
        if (idx === -1) return { modifiedCount: 0 };
        store[idx] = { ...store[idx], status: update.$set.status };
        return { modifiedCount: 1 };
      }),
      countDocuments: jest.fn((filter: Record<string, unknown>) => ({
        exec: jest.fn(async () => {
          if (filter.status === 'inactive_over_limit') {
            return store.filter((row) => row.status === 'inactive_over_limit').length;
          }
          return store.filter((row) => row.status !== 'inactive_over_limit').length;
        }),
      })),
      updateMany: jest.fn(),
    };

    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({ memberLimit }),
    } as unknown as WorkspaceEntitlementsService;

    const service = new WorkspaceMemberOverLimitReconcileService(
      membershipModel as never,
      entitlementsService,
    );

    return { service, store, membershipModel, entitlementsService };
  }

  it('deactivates newest members over starter limit and keeps owner', async () => {
    const ownerId = new Types.ObjectId();
    const { service, store } = createHarness(
      [
        { _id: new Types.ObjectId('000000000000000000000001'), userId: ownerId, role: 'owner' },
        ...Array.from({ length: 9 }, (_, i) => ({
          _id: new Types.ObjectId(`0000000000000000000000${String(i + 2).padStart(2, '0')}`),
          userId: new Types.ObjectId(`507f1f77bcf86cd7994390${String(i).padStart(2, '0')}`),
          role: 'member',
        })),
      ],
      5,
    );

    const result = await service.reconcileWorkspaceMembersAgainstLimit(workspaceId, { memberLimit: 5 });

    expect(result.deactivated).toBe(5);
    expect(result.reactivated).toBe(0);
    expect(store.find((row) => row.role === 'owner')?.status).toBe('active');
    expect(store.filter((row) => row.status === 'inactive_over_limit')).toHaveLength(5);
  });

  it('reactivates oldest inactive members when limit increases', async () => {
    const { service, store } = createHarness(
      [
        { _id: new Types.ObjectId('000000000000000000000001'), userId: new Types.ObjectId(), role: 'owner', status: 'active' },
        { _id: new Types.ObjectId('000000000000000000000002'), userId: new Types.ObjectId(), role: 'member', status: 'inactive_over_limit' },
        { _id: new Types.ObjectId('000000000000000000000003'), userId: new Types.ObjectId(), role: 'member', status: 'inactive_over_limit' },
        { _id: new Types.ObjectId('000000000000000000000004'), userId: new Types.ObjectId(), role: 'member', status: 'active' },
      ],
      10,
    );

    const result = await service.reconcileWorkspaceMembersAgainstLimit(workspaceId, { memberLimit: 10 });

    expect(result.reactivated).toBe(2);
    expect(store.every((row) => row.status === 'active')).toBe(true);
  });

  it('reconcileIfNeeded skips when already within limit', async () => {
    const { service } = createHarness(
      [{ _id: new Types.ObjectId(), userId: new Types.ObjectId(), role: 'owner' }],
      5,
    );

    const result = await service.reconcileIfNeeded(workspaceId, 5);
    expect(result).toBeNull();
  });
});
