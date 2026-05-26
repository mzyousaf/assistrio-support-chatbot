import {
  buildWorkspaceInviteEmailContent,
  buildWorkspaceInviteEmailSubject,
  deriveEmailAvatarInitials,
} from './workspace-invite-email.template';

const logoPath1 = 'https://drive.google.com/uc?export=view&id=1ztM1pusYZ_PpCNZdnFzh-_NpuV17wRrX';
const logoPath2 = 'https://drive.google.com/uc?export=view&id=1Z-ys-VYR42SDwjJpdOgBlTcGgy-uABFJ';
const supportUrl = 'https://assistrio.com/contact';

describe('workspace-invite-email.template', () => {
  const expiresAt = new Date('2026-06-15T12:00:00.000Z');
  const inviteUrl = 'https://app.assistrio.com/invite/plain-token-value';
  const copyrightYear = 2026;
  const logo = {
    markUrl: logoPath1,
    textUrl: logoPath2,
  };

  it('builds subject with workspace name', () => {
    expect(buildWorkspaceInviteEmailSubject('Acme Team')).toBe(
      "You're invited to join Acme Team on Assistrio",
    );
  });

  it('includes invite content, avatar initials, divider, support link, and copyright', () => {
    const content = buildWorkspaceInviteEmailContent({
      workspaceName: 'Acme Team',
      inviterName: 'Alex Admin',
      inviteeEmail: 'guest@example.com',
      invitedRole: 'member',
      expiresAt,
      inviteUrl,
      supportUrl,
      copyrightYear,
      logo,
    });

    expect(content.subject).toContain('Acme Team');
    expect(content.html).toContain('Acme Team');
    expect(content.html).toContain('Alex Admin');
    expect(content.html).not.toContain('admin@example.com');
    expect(content.html).toContain('Member');
    expect(content.html).toContain('June 15, 2026');
    expect(content.html).toContain(inviteUrl);
    expect(content.html).toContain('Accept invitation');
    expect(content.html).toContain('Invite details');
    expect(content.html).toContain('collaborate in this workspace');
    expect(content.html).not.toContain('manage workspace settings and invite teammates');
    expect(content.html).not.toContain('permissions assigned by an admin');
    expect(content.html).toContain('+');
    expect(content.html).toContain(deriveEmailAvatarInitials(null, 'guest@example.com'));
    expect(content.html).toContain(deriveEmailAvatarInitials('Alex Admin', null));
    expect(content.html).toContain('border-top:1px solid #e2e8f0');
    expect(content.html).toContain('Contact support');
    expect(content.html).toContain(supportUrl);
    expect(content.html).toContain('&copy; 2026 Assistrio. All rights reserved.');
    expect(content.html).not.toContain('AI support workspace management');
    expect(content.text).toContain(inviteUrl);
    expect(content.text).toContain('Need help? Contact support:');
    expect(content.text).toContain(supportUrl);
    expect(content.text).toContain('© 2026 Assistrio. All rights reserved.');
    expect(content.text).not.toContain('admin@example.com');
    expect(content.html).not.toContain('tokenHash');
  });

  it('omits support link when support URL is not configured', () => {
    const content = buildWorkspaceInviteEmailContent({
      workspaceName: 'Acme Team',
      inviterName: 'Alex Admin',
      inviteeEmail: 'guest@example.com',
      invitedRole: 'member',
      expiresAt,
      inviteUrl,
      copyrightYear,
      logo,
    });

    expect(content.html).not.toContain('Contact support');
    expect(content.text).not.toContain('Need help? Contact support:');
  });

  it('renders logo images without duplicate Assistrio text header when logo exists', () => {
    const content = buildWorkspaceInviteEmailContent({
      workspaceName: 'Acme Team',
      inviterName: 'Alex Admin',
      inviteeEmail: 'guest@example.com',
      invitedRole: 'admin',
      expiresAt,
      inviteUrl,
      logo,
    });

    expect(content.html).toContain('drive.google.com/uc?export=view&amp;id=1ztM1pusYZ_PpCNZdnFzh-_NpuV17wRrX');
    expect(content.html).not.toContain(
      "font-size:18px;font-weight:700;line-height:1.2;color:#0f172a;letter-spacing:-0.02em;\">\n      Assistrio",
    );
    expect(content.html).toContain('Admin');
  });

  it('uses text Assistrio brand when logo assets are missing', () => {
    const content = buildWorkspaceInviteEmailContent({
      workspaceName: 'Acme Team',
      inviterName: 'Alex Admin',
      inviteeEmail: 'guest@example.com',
      invitedRole: 'member',
      expiresAt,
      inviteUrl,
      logo: null,
    });

    expect(content.html).toContain('Assistrio');
  });
});
