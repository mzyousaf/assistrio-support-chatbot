import type { WorkspaceInviteRole } from '../models/workspace-invite.constants';
import {
  buildEmailAvatarPairHtml,
  deriveEmailAvatarInitials,
  resolveSupportUrl,
} from './email-avatar.util';
import { buildBrandedEmailHtml } from './branded-email-layout';
import type { AssistrioEmailLogoAssets } from './email-assets.util';
import { isUsableEmailLogoUrl } from './email-assets.util';

export type WorkspaceInviteEmailTemplateInput = {
  workspaceName: string;
  inviterName: string | null;
  inviteeEmail: string;
  inviterAvatarUrl?: string | null;
  invitedRole: WorkspaceInviteRole;
  expiresAt: Date;
  inviteUrl: string;
  supportUrl?: string | null;
  nodeEnv?: string | null;
  logo?: AssistrioEmailLogoAssets | null;
  copyrightYear?: number;
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

function inviterDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || 'A workspace admin';
}

function resolveLogoAssets(logo?: AssistrioEmailLogoAssets | null): AssistrioEmailLogoAssets | null {
  if (!logo) return null;

  const markUrl = logo.markUrl?.trim();
  const textUrl = logo.textUrl?.trim();

  const resolved: AssistrioEmailLogoAssets = {
    markUrl: markUrl && isUsableEmailLogoUrl(markUrl) ? markUrl : null,
    textUrl: textUrl && isUsableEmailLogoUrl(textUrl) ? textUrl : null,
  };

  if (resolved.markUrl && resolved.textUrl) {
    return resolved;
  }

  return null;
}

function detailRow(label: string, value: string, isLast = false): string {
  return `
    <tr>
      <td align="left" style="padding:${isLast ? '6px' : '6px'} 12px 6px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;vertical-align:top;width:38%;">
        ${escapeHtml(label)}
      </td>
      <td align="right" style="padding:6px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;color:#0f172a;font-weight:500;vertical-align:top;">
        ${value}
      </td>
    </tr>
  `.trim();
}

function renderSupportLine(supportUrl: string | null): string {
  if (!supportUrl) return '';

  return `
    <tr>
      <td align="left" style="padding:14px 0 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.55;color:#94a3b8;">
        Need help? <a href="${escapeHtml(supportUrl)}" style="color:#0f766e;text-decoration:underline;">Contact support</a>
      </td>
    </tr>
  `.trim();
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
  const inviterName = inviterDisplayName(input.inviterName);
  const inviteeEmail = input.inviteeEmail.trim();
  const roleLabel = formatRoleLabel(input.invitedRole);
  const expiryLabel = formatInviteExpiry(input.expiresAt);
  const inviteUrl = input.inviteUrl.trim();
  const supportUrl = resolveSupportUrl(input.supportUrl);
  const logo = resolveLogoAssets(input.logo);
  const copyrightYear = input.copyrightYear ?? new Date().getFullYear();
  const subject = buildWorkspaceInviteEmailSubject(workspaceName);

  const avatarPairHtml = buildEmailAvatarPairHtml(
    { email: inviteeEmail },
    { name: inviterName, imageUrl: input.inviterAvatarUrl },
    input.nodeEnv,
  );

  const textLines = [
    `You're invited to join ${workspaceName}.`,
    '',
    `${inviterName} invited you to collaborate in this workspace.`,
    '',
    'Accept invitation:',
    inviteUrl,
    '',
    'Invite details:',
    `Workspace: ${workspaceName}`,
    `Role: ${roleLabel}`,
    `Invited by: ${inviterName}`,
    `Expires: ${expiryLabel}`,
    '',
    "If you weren't expecting this invitation, you can ignore this email.",
  ];

  if (supportUrl) {
    textLines.push('', 'Need help? Contact support:', supportUrl);
  }

  textLines.push('', `© ${copyrightYear} Assistrio. All rights reserved.`);

  const text = textLines.join('\n');

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="left" style="padding:0 0 12px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:700;line-height:1.3;color:#0f172a;letter-spacing:-0.02em;">
          You&rsquo;re invited to join ${escapeHtml(workspaceName)}
        </td>
      </tr>
      <tr>
        <td align="left" style="padding:0 0 24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#64748b;">
          ${escapeHtml(inviterName)} invited you to collaborate in this workspace.
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 28px;">
          <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background-color:#0d9488;color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:600;font-size:14px;line-height:1;padding:12px 18px;border-radius:8px;">
            Accept invitation
          </a>
        </td>
      </tr>
      <tr>
        <td align="left" style="padding:0 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <div style="margin:0 0 10px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;font-weight:600;line-height:1.4;color:#0f172a;">
                  Invite details
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${detailRow('Workspace', escapeHtml(workspaceName))}
                  ${detailRow('Role', escapeHtml(roleLabel))}
                  ${detailRow('Invited by', escapeHtml(inviterName))}
                  ${detailRow('Expires', escapeHtml(expiryLabel), true)}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="left" style="padding:0 0 6px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.55;color:#94a3b8;">
          If the button doesn&rsquo;t work, copy and paste this link into your browser:
        </td>
      </tr>
      <tr>
        <td align="left" style="padding:0 0 24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;line-height:1.6;word-break:break-all;color:#94a3b8;">
          <a href="${escapeHtml(inviteUrl)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(inviteUrl)}</a>
        </td>
      </tr>
      <tr>
        <td align="left" style="padding:16px 0 0;border-top:1px solid #e2e8f0;margin-top:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.55;color:#94a3b8;">
          If you weren&rsquo;t expecting this invitation, you can safely ignore this email.
        </td>
      </tr>
      ${renderSupportLine(supportUrl)}
    </table>
  `.trim();

  const html = buildBrandedEmailHtml({
    logo,
    avatarPairHtml,
    contentHtml,
    copyrightYear,
  });

  return { subject, html, text };
}

export { deriveEmailAvatarInitials };
