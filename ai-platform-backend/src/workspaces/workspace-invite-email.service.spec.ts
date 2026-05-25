import { EmailService } from '../email/email.service';
import { WorkspaceInviteEmailService } from './workspace-invite-email.service';

describe('WorkspaceInviteEmailService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const invitedByUserId = '507f1f77bcf86cd799439012';
  const inviteUrl = 'http://localhost:3002/invite/plain-token';

  function buildService(options?: { sendResult?: Awaited<ReturnType<EmailService['send']>> }) {
    const emailService = {
      send: jest.fn().mockResolvedValue(options?.sendResult ?? { ok: true, id: 'email_123' }),
    } as unknown as EmailService;

    const workspaceModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ name: 'Acme Team' }),
        }),
      }),
    };

    const userModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            email: 'admin@example.com',
            firstName: 'Alex',
            lastName: 'Admin',
          }),
        }),
      }),
    };

    const service = new WorkspaceInviteEmailService(
      emailService,
      workspaceModel as never,
      userModel as never,
    );

    return { service, emailService, workspaceModel, userModel };
  }

  it('sends invite email to the invited recipient with workspace name and invite URL', async () => {
    const { service, emailService } = buildService();
    const expiresAt = new Date('2026-06-15T12:00:00.000Z');

    const result = await service.sendWorkspaceInviteEmail({
      workspaceId,
      invitedByUserId,
      recipientEmail: 'guest@example.com',
      role: 'member',
      expiresAt,
      inviteUrl,
    });

    expect(result).toEqual({ ok: true, id: 'email_123' });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        subject: expect.stringContaining('Acme Team'),
        html: expect.stringContaining(inviteUrl),
        text: expect.stringContaining(inviteUrl),
        replyTo: 'admin@example.com',
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.not.stringContaining('tokenHash'),
      }),
    );
  });

  it('loads workspace and inviter by ObjectId', async () => {
    const { service, workspaceModel, userModel } = buildService();
    await service.sendWorkspaceInviteEmail({
      workspaceId,
      invitedByUserId,
      recipientEmail: 'guest@example.com',
      role: 'admin',
      expiresAt: new Date(),
      inviteUrl,
    });

    expect(workspaceModel.findById).toHaveBeenCalledWith(workspaceId);
    expect(userModel.findById).toHaveBeenCalledWith(invitedByUserId);
  });
});
