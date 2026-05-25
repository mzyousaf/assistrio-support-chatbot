import type { WorkspaceInviteRole } from '../models/workspace-invite.constants';

export type WorkspaceInviteEmailTemplateInput = {
  workspaceName: string;
  inviterName: string | null;
  inviterEmail: string | null;
  invitedRole: WorkspaceInviteRole;
  expiresAt: Date;
  inviteUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInviteExpiry(expiresAt: Date): string {
  return expiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatRoleLabel(role: WorkspaceInviteRole): string {
  return role === 'admin' ? 'Admin' : 'Member';
}

function inviterLine(input: WorkspaceInviteEmailTemplateInput): string {
  const name = input.inviterName?.trim();
  const email = input.inviterEmail?.trim();
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return 'A workspace admin';
}

export function buildWorkspaceInviteEmailSubject(workspaceName: string): string {
  const name = workspaceName.trim() || 'a workspace';
  return `You're invited to join ${name} on Assistrio`;
}

export function buildWorkspaceInviteEmailContent(input: WorkspaceInviteEmailTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const workspaceName = input.workspaceName.trim() || 'a workspace';
  const inviter = inviterLine(input);
  const roleLabel = formatRoleLabel(input.invitedRole);
  const expiryLabel = formatInviteExpiry(input.expiresAt);
  const inviteUrl = input.inviteUrl.trim();
  const subject = buildWorkspaceInviteEmailSubject(workspaceName);

  const text = [
    `You're invited to join ${workspaceName} on Assistrio.`,
    '',
    `${inviter} invited you as a ${roleLabel}.`,
    `This invite expires on ${expiryLabel}.`,
    '',
    `Accept your invite: ${inviteUrl}`,
    '',
    'If you did not expect this email, you can ignore it.',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a;max-width:560px;">
      <p style="margin:0 0 16px;font-size:16px;">You're invited to join <strong>${escapeHtml(workspaceName)}</strong> on Assistrio.</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;">
        ${escapeHtml(inviter)} invited you as a <strong>${escapeHtml(roleLabel)}</strong>.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b;">This invite expires on ${escapeHtml(expiryLabel)}.</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px;">
          Accept invite
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or copy this link into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${escapeHtml(inviteUrl)}" style="color:#0d9488;">${escapeHtml(inviteUrl)}</a></p>
      <p style="margin:0;font-size:12px;color:#94a3b8;">If you did not expect this email, you can ignore it.</p>
    </div>
  `.trim();

  return { subject, html, text };
}
