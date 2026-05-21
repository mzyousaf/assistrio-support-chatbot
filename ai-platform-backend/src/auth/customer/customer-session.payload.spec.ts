import { buildCustomerSessionPayload } from './customer-session.payload';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import type { RequestUser } from '../shared/request-user.types';

describe('buildCustomerSessionPayload', () => {
  const user: RequestUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    role: 'customer',
    firstName: 'Ada',
    lastName: 'Lovelace',
    picture: 'https://example.com/avatar.png',
  };

  function mockWorkspacesService(overrides: Partial<WorkspacesService> = {}): WorkspacesService {
    return {
      ensurePersonalWorkspaceForUser: jest.fn().mockResolvedValue(undefined),
      getWorkspaceIdsForUser: jest.fn().mockResolvedValue(['ws1']),
      getWorkspacesSummaryForUser: jest.fn().mockResolvedValue([{ id: 'ws1', name: 'Ada workspace' }]),
      ...overrides,
    } as unknown as WorkspacesService;
  }

  it('returns session fields without tokens or provider secrets', async () => {
    const ws = mockWorkspacesService();
    const payload = await buildCustomerSessionPayload(user, ws);

    expect(payload).toEqual({
      id: '507f1f77bcf86cd799439011',
      email: 'user@example.com',
      role: 'customer',
      workspaceIds: ['ws1'],
      workspaces: [{ id: 'ws1', name: 'Ada workspace' }],
      firstName: 'Ada',
      lastName: 'Lovelace',
      picture: 'https://example.com/avatar.png',
    });
    expect(payload).not.toHaveProperty('needsOnboarding');
    expect(payload).not.toHaveProperty('activeWorkspaceId');
    expect(Object.keys(payload).sort()).toEqual(
      ['email', 'firstName', 'id', 'lastName', 'picture', 'role', 'workspaceIds', 'workspaces'].sort(),
    );
  });

  it('ensures personal workspace before listing workspaces', async () => {
    const ensure = jest.fn().mockResolvedValue(undefined);
    const getIds = jest.fn().mockResolvedValue([]);
    const getSummary = jest.fn().mockResolvedValue([]);
    const ws = mockWorkspacesService({
      ensurePersonalWorkspaceForUser: ensure,
      getWorkspaceIdsForUser: getIds,
      getWorkspacesSummaryForUser: getSummary,
    });

    await buildCustomerSessionPayload(user, ws);

    expect(ensure).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(getIds).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(getSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('omits optional profile fields when absent', async () => {
    const minimal: RequestUser = {
      _id: 'abc',
      email: 'min@example.com',
      role: 'customer',
    };
    const payload = await buildCustomerSessionPayload(minimal, mockWorkspacesService());

    expect(payload.firstName).toBeUndefined();
    expect(payload.lastName).toBeUndefined();
    expect(payload.picture).toBeUndefined();
  });
});
