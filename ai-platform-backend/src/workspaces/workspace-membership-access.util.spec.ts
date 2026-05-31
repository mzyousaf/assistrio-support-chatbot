import { ForbiddenException } from '@nestjs/common';
import {
  assertWorkspaceActiveMembership,
  WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_CODE,
} from './workspace-membership-access.util';

describe('workspace-membership-access.util', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function createModel(status: string | null) {
    return {
      findOne: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue(status == null ? null : { status }),
        })),
      })),
    };
  }

  it('throws workspace_member_inactive_over_limit for inactive membership', async () => {
    const model = createModel('inactive_over_limit');
    await expect(assertWorkspaceActiveMembership(model as never, userId, workspaceId)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_CODE },
    });
  });

  it('allows active membership', async () => {
    const model = createModel('active');
    await expect(assertWorkspaceActiveMembership(model as never, userId, workspaceId)).resolves.toBeUndefined();
  });

  it('denies missing membership', async () => {
    const model = createModel(null);
    await expect(assertWorkspaceActiveMembership(model as never, userId, workspaceId)).rejects.toMatchObject({
      response: { errorCode: 'workspace_access_denied' },
    });
  });
});
