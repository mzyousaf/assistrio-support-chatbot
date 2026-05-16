/**
 * Maps backend `oauth_error` query codes (see GoogleOAuthErrorCode) to customer-facing copy.
 * Keep messages non-technical and avoid exposing raw server details.
 */
const MESSAGES: Record<string, string> = {
  oauth_not_configured:
    'Sign-in isn’t available on this environment right now. Please try again later or contact support.',
  google_denied: 'You canceled Google sign-in. You can try again whenever you’re ready.',
  invalid_state: 'This sign-in link expired or was invalid. Please try signing in again.',
  missing_code: 'We couldn’t complete the connection to Google. Please try signing in again.',
  token_exchange_failed: 'We couldn’t finish signing you in with Google. Please try again in a moment.',
  userinfo_failed: 'We couldn’t verify your Google account. Please try signing in again.',
  missing_email:
    'Your Google account didn’t share an email we can use. Try another Google account or update your Google profile settings.',
  missing_subject: 'We couldn’t confirm your Google account. Please try again or use a different Google account.',
  email_not_verified: 'Please verify your email address with Google, then try signing in again.',
  admin_email_conflict:
    'This email is reserved for staff access. Sign in with a different Google account or contact support.',
  google_subject_email_mismatch:
    'This Google account doesn’t match the email we have on file. Try the Google account you used to register, or contact support.',
  email_linked_different_google:
    'This email is already linked to a different Google account. Sign in with that Google account instead.',
  superadmin_google_login_forbidden:
    'Google sign-in isn’t available for this account type. Please contact support if you need help.',
};

const FALLBACK =
  'Something went wrong while signing in. Please try again, or contact support if it keeps happening.';

export function oauthLoginErrorMessage(code: string | null | undefined): string | null {
  if (code == null || !String(code).trim()) return null;
  const key = String(code).trim();
  return MESSAGES[key] ?? FALLBACK;
}
