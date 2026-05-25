import { WorkspaceMembershipSchema } from './workspace-membership.schema';
import { WORKSPACE_MEMBER_ROLES } from './workspace-membership.schema';

describe('WorkspaceMembership schema role enum', () => {
  const rolePath = WorkspaceMembershipSchema.path('role') as { enumValues?: readonly string[] };

  it('accepts owner, admin, and member roles', () => {
    expect(rolePath.enumValues).toEqual(expect.arrayContaining([...WORKSPACE_MEMBER_ROLES]));
  });
});
