import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { AppConfig } from '../config/config.factory';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SendTrialAccessEmailInput = {
  toEmail: string;
  recipientName: string;
  verifyUrl: string;
};

export type SendContactToSupportInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type EmailSendResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'missing_api_key' | 'resend_error'; message: string };

function buildTrialAccessHtml(input: SendTrialAccessEmailInput) {
  const greeting = input.recipientName.trim()
    ? `Hi ${escapeHtml(input.recipientName.trim())},`
    : 'Hi there,';
  const safeUrl = escapeHtml(input.verifyUrl);

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your Assistrio access link</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px -16px rgba(15,23,42,0.15);">
            <tr>
              <td style="padding:28px 28px 8px 28px;">
                <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0d9488;">Assistrio</p>
                <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.3;color:#0f172a;font-weight:600;">Your Assistrio trial access link</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;font-size:16px;line-height:1.6;color:#334155;">
                <p style="margin:0 0 16px 0;">${greeting}</p>
                <p style="margin:0 0 16px 0;">Thanks for starting with Assistrio. Your secure access link is ready — use it to continue setting up your AI agent.</p>
                <p style="margin:0 0 24px 0;">
                  <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#14b8a6);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;">Continue setup</a>
                </p>
                <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Button not working? Paste this link into your browser:</p>
                <p style="margin:0 0 20px 0;font-size:12px;word-break:break-all;color:#0d9488;">${safeUrl}</p>
                <p style="margin:0;font-size:13px;color:#64748b;">This link expires in 48 hours for your security. If you didn&apos;t request this, you can ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#94a3b8;">
                Assistrio — AI support agents for your website
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

function buildContactHtml(input: SendContactToSupportInput) {
  return `
    <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(input.message)}</pre>
  `.trim();
}

@Injectable()
export class EmailService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  buildTrialVerifyUrl(rawToken: string): string | null {
    const raw = this.configService.get('landingPublicSiteUrl', { infer: true })?.trim();
    if (!raw || !/^https?:\/\//i.test(raw)) {
      return null;
    }
    const origin = new URL(raw).origin;
    const u = new URL('/trial/verify', origin);
    u.searchParams.set('t', rawToken);
    return u.toString();
  }

  async sendTrialAccessEmail(input: SendTrialAccessEmailInput): Promise<EmailSendResult> {
    const apiKey = this.configService.get('resendApiKey', { infer: true })?.trim();
    if (!apiKey) {
      return {
        ok: false,
        reason: 'missing_api_key',
        message: 'RESEND_API_KEY is not configured.',
      };
    }

    const from =
      this.configService.get('trialFromEmail', { infer: true })?.trim() ||
      this.configService.get('contactFromEmail', { infer: true })?.trim() ||
      'Assistrio <onboarding@resend.dev>';

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [input.toEmail],
      subject: 'Your Assistrio trial access link',
      html: buildTrialAccessHtml(input),
    });

    if (error) {
      console.error('[EmailService] Resend trial email error:', error);
      return {
        ok: false,
        reason: 'resend_error',
        message: error.message ?? 'Resend rejected the send.',
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        reason: 'resend_error',
        message: 'No email id returned from Resend.',
      };
    }

    return { ok: true, id: data.id };
  }

  async sendContactToSupport(input: SendContactToSupportInput): Promise<EmailSendResult> {
    const apiKey = this.configService.get('resendApiKey', { infer: true })?.trim();
    if (!apiKey) {
      return {
        ok: false,
        reason: 'missing_api_key',
        message: 'RESEND_API_KEY is not configured.',
      };
    }

    const from =
      this.configService.get('contactFromEmail', { infer: true })?.trim() ||
      'Assistrio <onboarding@resend.dev>';
    const to =
      this.configService.get('contactToEmail', { infer: true })?.trim() || 'support@assistrio.com';

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: input.email,
      subject: input.subject,
      html: buildContactHtml(input),
    });

    if (error) {
      console.error('[EmailService] Resend contact email error:', error);
      return {
        ok: false,
        reason: 'resend_error',
        message: error.message ?? 'Resend rejected the send.',
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        reason: 'resend_error',
        message: 'No email id returned from Resend.',
      };
    }

    return { ok: true, id: data.id };
  }
}
