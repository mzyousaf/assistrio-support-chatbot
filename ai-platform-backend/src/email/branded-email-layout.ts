import type { AssistrioEmailLogoAssets } from './email-assets.util';

export type BrandedEmailLayoutOptions = {
  /** Inner card body HTML (already escaped where needed). */
  contentHtml: string;
  logo?: AssistrioEmailLogoAssets | null;
  avatarPairHtml?: string | null;
  copyrightYear?: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEmailLogo(logo?: AssistrioEmailLogoAssets | null): string {
  const markUrl = logo?.markUrl?.trim();
  const textUrl = logo?.textUrl?.trim();
  if (markUrl && textUrl) {
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left">
        <tr style="height:40px;">
          <td valign="middle" align="center" width="30" height="30" style="width:30px;height:30px;padding:0 3px 0 0;vertical-align:middle;line-height:0;font-size:0;">
            <img src="${escapeHtml(markUrl)}" alt="" width="30" height="30" style="display:block;width:30px;height:30px;border:0;vertical-align:middle;" />
          </td>
          <td valign="middle" align="left" width="150" height="25" style="width:150px;height:25px;padding:0;vertical-align:middle;line-height:0;font-size:0;">
            <img src="${escapeHtml(textUrl)}" alt="Assistrio" width="150" height="25" style="display:block;width:150px;height:25px;max-width:150px;border:0;vertical-align:middle;" />
          </td>
        </tr>
      </table>
    `.trim();
  }

  return `
    <span style="display:block;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;font-weight:700;line-height:1.2;color:#0f172a;letter-spacing:-0.02em;">
      Assistrio
    </span>
  `.trim();
}

/**
 * Table-based, inline-CSS email shell for Assistrio transactional messages.
 */
export function buildBrandedEmailHtml(options: BrandedEmailLayoutOptions): string {
  const copyrightYear = options.copyrightYear ?? new Date().getFullYear();
  const avatarPairHtml = options.avatarPairHtml?.trim();

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Assistrio</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f8fafc;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:40px 44px;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 4px 16px rgba(15,23,42,0.04);">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="left" style="padding:0 0 ${avatarPairHtml ? '24px' : '28px'};">
                      ${renderEmailLogo(options.logo)}
                    </td>
                  </tr>
                  ${
                    avatarPairHtml
                      ? `
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      ${avatarPairHtml}
                    </td>
                  </tr>
                  `.trim()
                      : ''
                  }
                  <tr>
                    <td align="left">
                      ${options.contentHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 8px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">&copy; ${copyrightYear} Assistrio. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
