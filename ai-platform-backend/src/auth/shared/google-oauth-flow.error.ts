/** Machine-readable OAuth failure codes for redirects and logs. */
export type GoogleOAuthErrorCode =
  | 'oauth_not_configured'
  | 'invalid_state'
  | 'missing_code'
  | 'google_denied'
  | 'token_exchange_failed'
  | 'userinfo_failed'
  | 'missing_email'
  | 'missing_subject'
  | 'email_not_verified'
  | 'admin_email_conflict'
  | 'google_subject_email_mismatch'
  | 'email_linked_different_google'
  | 'superadmin_google_login_forbidden';

export class GoogleOAuthFlowError extends Error {
  constructor(
    public readonly code: GoogleOAuthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GoogleOAuthFlowError';
  }
}
