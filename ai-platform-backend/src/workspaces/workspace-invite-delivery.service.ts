import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_DELIVERY_FAILED_CODE,
  EMAIL_DELIVERY_FAILED_MESSAGE,
  EMAIL_DELIVERY_NOT_CONFIGURED_CODE,
  EMAIL_DELIVERY_NOT_CONFIGURED_MESSAGE,
} from '../email/email.constants';
import type { SendEmailResult } from '../email/email.service';
import { shouldExposeWorkspaceInviteUrl } from './workspace-invite-url.util';

@Injectable()
export class WorkspaceInviteDeliveryService {
  private readonly logger = new Logger(WorkspaceInviteDeliveryService.name);

  constructor(private readonly configService: ConfigService) {}

  assertInviteEmailDeliveryResult(result: SendEmailResult, context: 'create' | 'resend'): void {
    if (result.ok) return;

    const isProduction = this.isProduction();
    const action = context === 'create' ? 'create invite' : 'resend invite';

    if (result.reason === 'not_configured') {
      if (isProduction) {
        throw new ServiceUnavailableException({
          error: EMAIL_DELIVERY_NOT_CONFIGURED_MESSAGE,
          errorCode: EMAIL_DELIVERY_NOT_CONFIGURED_CODE,
        });
      }
      this.logger.warn(
        `[${action}] Email delivery not configured (${result.message}). Invite saved; inviteUrl may still be returned in non-production.`,
      );
      return;
    }

    if (isProduction) {
      throw new BadGatewayException({
        error: EMAIL_DELIVERY_FAILED_MESSAGE,
        errorCode: EMAIL_DELIVERY_FAILED_CODE,
      });
    }

    this.logger.warn(
      `[${action}] Email delivery failed (${result.message}). Invite saved; inviteUrl may still be returned in non-production.`,
    );
  }

  shouldExposeInviteUrl(): boolean {
    return shouldExposeWorkspaceInviteUrl(this.configService.get<string>('nodeEnv'));
  }

  private isProduction(): boolean {
    return String(this.configService.get<string>('nodeEnv') ?? 'development')
      .trim()
      .toLowerCase() === 'production';
  }
}
