export type EmailAvatarPersonInput = {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
};

function isLocalhostHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.localhost');
}

function isGoogleDriveUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.trim().toLowerCase();
    return host === 'drive.google.com' || host.endsWith('.drive.google.com');
  } catch {
    return false;
  }
}

export function isUsableEmailAvatarUrl(
  url: string | null | undefined,
  nodeEnv?: string | null,
): boolean {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (isGoogleDriveUrl(trimmed)) return false;
    if (isLocalhostHostname(parsed.hostname)) return false;

    const isProduction = String(nodeEnv ?? '').trim().toLowerCase() === 'production';
    if (isProduction && parsed.protocol !== 'https:') return false;

    return true;
  } catch {
    return false;
  }
}

export function deriveEmailAvatarInitials(name: string | null | undefined, email: string | null | undefined): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
    }
    const word = parts[0] ?? trimmedName;
    return word.slice(0, 2).toUpperCase();
  }

  const localPart = String(email ?? '')
    .trim()
    .split('@')[0]
    ?.replace(/[^a-zA-Z0-9]/g, '');
  if (!localPart) return '?';
  return localPart.slice(0, 2).toUpperCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAvatarCircle(person: EmailAvatarPersonInput, nodeEnv?: string | null): string {
  const initials = deriveEmailAvatarInitials(person.name, person.email);
  const imageUrl = person.imageUrl?.trim();
  const safeImageUrl =
    imageUrl && isUsableEmailAvatarUrl(imageUrl, nodeEnv) ? escapeHtml(imageUrl) : null;

  if (safeImageUrl) {
    return `
      <img src="${safeImageUrl}" alt="${escapeHtml(initials)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:50%;border:1px solid #e2e8f0;object-fit:cover;" />
    `.trim();
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44" height="44" style="width:44px;height:44px;border-collapse:separate;">
      <tr>
        <td align="center" valign="middle" width="44" height="44" style="width:44px;height:44px;border-radius:50%;background-color:#e6fffb;border:1px solid #e2e8f0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;line-height:44px;color:#0f766e;text-align:center;">
          ${escapeHtml(initials)}
        </td>
      </tr>
    </table>
  `.trim();
}

export function buildEmailAvatarPairHtml(
  invitee: EmailAvatarPersonInput,
  inviter: EmailAvatarPersonInput,
  nodeEnv?: string | null,
): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td align="center" valign="middle" style="padding:0;">
          ${renderAvatarCircle(invitee, nodeEnv)}
        </td>
        <td align="center" valign="middle" style="padding:0 12px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;line-height:1;color:#94a3b8;">
          +
        </td>
        <td align="center" valign="middle" style="padding:0;">
          ${renderAvatarCircle(inviter, nodeEnv)}
        </td>
      </tr>
    </table>
  `.trim();
}

export function resolveSupportUrl(value: string | null | undefined): string | null {
  const url = String(value ?? '').trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}
