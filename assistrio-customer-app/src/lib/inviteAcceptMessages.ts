export type InviteAcceptErrorCode =
  | 'workspace_invite_not_found'
  | 'workspace_invite_expired'
  | 'workspace_invite_cancelled'
  | 'workspace_invite_already_accepted'
  | 'workspace_invite_email_mismatch';

export type InviteAcceptMessageTone = 'neutral' | 'warning' | 'success';

export type InviteAcceptMessage = {
  title: string;
  message: string;
  tone: InviteAcceptMessageTone;
};

export function inviteAcceptMessage(code: string | null | undefined): InviteAcceptMessage | null {
  switch (code) {
    case 'workspace_invite_not_found':
      return {
        title: 'Invite not found',
        message: 'This invite link is invalid or no longer available.',
        tone: 'neutral',
      };
    case 'workspace_invite_expired':
      return {
        title: 'Invite expired',
        message: 'This invitation link has expired. Ask a workspace admin to send a new invite.',
        tone: 'warning',
      };
    case 'workspace_invite_cancelled':
      return {
        title: 'Invite cancelled',
        message: 'This invitation was cancelled by a workspace admin.',
        tone: 'warning',
      };
    case 'workspace_invite_already_accepted':
      return {
        title: "You're already in this workspace",
        message: 'This invitation has already been accepted.',
        tone: 'success',
      };
    case 'workspace_invite_email_mismatch':
      return {
        title: 'Wrong Google account',
        message: 'Sign in with the Google account that received this invite.',
        tone: 'warning',
      };
    default:
      return null;
  }
}
