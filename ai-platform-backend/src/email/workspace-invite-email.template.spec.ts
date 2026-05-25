import { buildWorkspaceInviteEmailContent, buildWorkspaceInviteEmailSubject } from './workspace-invite-email.template';

describe('workspace-invite-email.template', () => {
  const expiresAt = new Date('2026-06-15T12:00:00.000Z');
  const inviteUrl = 'http://localhost:3002/invite/plain-token-value';

  it('builds subject with workspace name', () => {
    expect(buildWorkspaceInviteEmailSubject('Acme Team')).toBe(
      "You're invited to join Acme Team on Assistrio",
    );
  });

  it('includes workspace name, role, expiry, and invite URL in html and text', () => {
    const content = buildWorkspaceInviteEmailContent({
      workspaceName: 'Acme Team',
      inviterName: 'Alex Admin',
      inviterEmail: 'admin@example.com',
      invitedRole: 'member',
      expiresAt,
      inviteUrl,
    });

    expect(content.subject).toContain('Acme Team');
    expect(content.html).toContain('Acme Team');
    expect(content.html).toContain('Alex Admin');
    expect(content.html).toContain('Member');
    expect(content.html).toContain('June 15, 2026');
    expect(content.html).toContain(inviteUrl);
    expect(content.text).toContain(inviteUrl);
    expect(content.html).not.toContain('tokenHash');
  });
});
