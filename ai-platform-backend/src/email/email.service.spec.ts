import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => mockSend(...args) },
  })),
}));

describe('EmailService', () => {
  function buildService(config: Record<string, string>) {
    const configService = {
      get: jest.fn((key: string) => config[key] ?? ''),
    } as unknown as ConfigService;
    return new EmailService(configService);
  }

  beforeEach(() => {
    mockSend.mockReset();
  });

  it('returns not_configured when RESEND env is missing', async () => {
    const service = buildService({});
    const result = await service.send({
      to: 'guest@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
    expect(result).toEqual({
      ok: false,
      reason: 'not_configured',
      message: 'RESEND_API_KEY and EMAIL_FROM must be configured.',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends email via Resend when configured', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    const service = buildService({
      resendApiKey: 're_test',
      emailFrom: 'Assistrio <noreply@assistrio.com>',
      emailReplyTo: 'support@assistrio.com',
    });

    const result = await service.send({
      to: 'guest@example.com',
      subject: 'Invite',
      html: '<p>Join</p>',
      text: 'Join',
      replyTo: 'admin@example.com',
    });

    expect(result).toEqual({ ok: true, id: 'email_123' });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Assistrio <noreply@assistrio.com>',
        to: ['guest@example.com'],
        subject: 'Invite',
        replyTo: 'admin@example.com',
      }),
    );
  });

  it('returns send_failed when Resend rejects the send', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid from address' } });
    const service = buildService({
      resendApiKey: 're_test',
      emailFrom: 'Assistrio <noreply@assistrio.com>',
    });

    const result = await service.send({
      to: 'guest@example.com',
      subject: 'Invite',
      html: '<p>Join</p>',
      text: 'Join',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'send_failed',
      message: 'Invalid from address',
    });
  });
});
