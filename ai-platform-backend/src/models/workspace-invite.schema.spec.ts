import { WORKSPACE_INVITE_ROLES } from './workspace-invite.constants';
import { WorkspaceInviteSchema } from './workspace-invite.schema';
import { WORKSPACE_MEMBER_ROLES } from './workspace-membership.schema';

describe('WorkspaceInvite schema role enum', () => {
  const rolePath = WorkspaceInviteSchema.path('role') as { enumValues?: readonly string[] };

  it('accepts admin and member invite roles', () => {
    expect(rolePath.enumValues).toEqual(expect.arrayContaining([...WORKSPACE_INVITE_ROLES]));
  });

  it('rejects owner invite role', () => {
    expect(rolePath.enumValues).not.toContain('owner');
  });

  it('membership roles include owner but invite roles do not', () => {
    expect(WORKSPACE_MEMBER_ROLES).toContain('owner');
    expect(WORKSPACE_INVITE_ROLES).not.toContain('owner');
  });
});
