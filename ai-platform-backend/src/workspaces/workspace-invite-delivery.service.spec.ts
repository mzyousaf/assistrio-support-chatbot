import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_DELIVERY_FAILED_CODE,
  EMAIL_DELIVERY_NOT_CONFIGURED_CODE,
} from '../email/email.constants';
import { WorkspaceInviteDeliveryService } from './workspace-invite-delivery.service';

describe('WorkspaceInviteDeliveryService', () => {
  function buildService(nodeEnv: string) {
    const configService = {
      get: jest.fn((key: string) => (key === 'nodeEnv' ? nodeEnv : '')),
    } as unknown as ConfigService;
    return new WorkspaceInviteDeliveryService(configService);
  }

  it('throws not configured in production', () => {
    const service = buildService('production');
    try {
      service.assertInviteEmailDeliveryResult(
        { ok: false, reason: 'not_configured', message: 'missing' },
        'create',
      );
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err as ServiceUnavailableException).getResponse()).toMatchObject({
        errorCode: EMAIL_DELIVERY_NOT_CONFIGURED_CODE,
      });
    }
  });

  it('allows missing config in development without throwing', () => {
    const service = buildService('development');
    expect(() =>
      service.assertInviteEmailDeliveryResult(
        { ok: false, reason: 'not_configured', message: 'missing' },
        'create',
      ),
    ).not.toThrow();
  });

  it('throws delivery failed in production but not in development', () => {
    const prod = buildService('production');
    try {
      prod.assertInviteEmailDeliveryResult(
        { ok: false, reason: 'send_failed', message: 'Resend down' },
        'resend',
      );
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayException);
      expect((err as BadGatewayException).getResponse()).toMatchObject({
        errorCode: EMAIL_DELIVERY_FAILED_CODE,
      });
    }

    const dev = buildService('development');
    expect(() =>
      dev.assertInviteEmailDeliveryResult(
        { ok: false, reason: 'send_failed', message: 'Resend down' },
        'resend',
      ),
    ).not.toThrow();
  });
});
