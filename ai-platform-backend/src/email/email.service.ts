import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_configured'; message: string }
  | { ok: false; reason: 'send_failed'; message: string };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return !!(this.getResendApiKey() && this.getEmailFrom());
  }

  getResendApiKey(): string {
    return this.configService.get<string>('resendApiKey')?.trim() ?? '';
  }

  getEmailFrom(): string {
    return this.configService.get<string>('emailFrom')?.trim() ?? '';
  }

  getEmailReplyTo(): string | undefined {
    const value = this.configService.get<string>('emailReplyTo')?.trim();
    return value || undefined;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.getResendApiKey();
    const from = this.getEmailFrom();
    const to = String(input.to ?? '').trim();

    if (!apiKey || !from) {
      return {
        ok: false,
        reason: 'not_configured',
        message: 'RESEND_API_KEY and EMAIL_FROM must be configured.',
      };
    }
    if (!to) {
      return {
        ok: false,
        reason: 'send_failed',
        message: 'Recipient email is required.',
      };
    }

    const replyTo = input.replyTo?.trim() || this.getEmailReplyTo();

    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(replyTo ? { replyTo } : {}),
      });

      if (error) {
        this.logger.warn(`Resend rejected email to ${to}: ${error.message ?? 'unknown error'}`);
        return {
          ok: false,
          reason: 'send_failed',
          message: error.message ?? 'Email provider rejected the send.',
        };
      }

      if (!data?.id) {
        this.logger.warn(`Resend returned no email id for recipient ${to}`);
        return {
          ok: false,
          reason: 'send_failed',
          message: 'Email provider did not return a message id.',
        };
      }

      return { ok: true, id: data.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Resend send failed for ${to}: ${message}`);
      return {
        ok: false,
        reason: 'send_failed',
        message,
      };
    }
  }
}
