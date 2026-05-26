import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  Clock3,
  Users,
} from 'lucide-react';
import { customerGoogleAuthStartUrl } from '../api/client';
import { getCustomerInvitePreview, postCustomerInviteAccept } from '../api/customerApi';
import type { ApiErrorBody, CustomerInvitePreview } from '../api/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import {
  InviteAcceptShell,
  InviteCtaBlock,
  InvitePrimaryActions,
  InviteStatusPanel,
  InviteSupportLink,
  InviteValidHeading,
  InviteWorkspaceBadge,
  InviteWorkspaceSummary,
} from '../components/invite/InviteAcceptShell';
import { GoogleSignInButton, GoogleSignInLink } from '../components/auth/GoogleSignInButton';
import { InviteLegalNotice } from '../components/invite/InviteLegalNotice';
import { InlineLoader, PageLoaderSpinner } from '../components/PageLoader';
import { Button } from '../components/ui/Button';
import { inviteAcceptMessage } from '../lib/inviteAcceptMessages';
import { getLandingSiteUrl } from '../lib/landingSiteUrl';
import { workspaceRoleLabel } from '../lib/workspaceRoles';
import { CUSTOMER_POST_LOGIN_DEST, CUSTOMER_ROUTES } from '../routes/customerRoutes';

type PreviewState =
  | { phase: 'loading' }
  | { phase: 'ready'; preview: CustomerInvitePreview }
  | { phase: 'error'; title: string; message: string; errorCode: string | null };

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function landingLinkClassName(): string {
  return 'inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 no-underline shadow-none transition-colors hover:border-slate-300 hover:bg-slate-50';
}

function errorSecondaryMessage(errorCode: string | null): string | undefined {
  switch (errorCode) {
    case 'workspace_invite_cancelled':
      return 'Ask the workspace owner to send you a new invitation if you still need access.';
    case 'workspace_invite_expired':
      return 'Ask a workspace admin to send a new invite.';
    default:
      return undefined;
  }
}

function errorBodyMessage(errorCode: string | null, fallback: string): string {
  if (errorCode === 'workspace_invite_expired') {
    return 'This invitation link has expired.';
  }
  return fallback;
}

export function InviteAcceptPage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { status, customer, refresh, logout, logoutInFlight } = useCustomerAuth();
  const [previewState, setPreviewState] = useState<PreviewState>({ phase: 'loading' });
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptInFlight, setAcceptInFlight] = useState(false);
  const [acceptRedirecting, setAcceptRedirecting] = useState(false);
  const [emailMismatch, setEmailMismatch] = useState<{ invitedEmail: string; currentEmail: string } | null>(
    null,
  );

  const oauthError = searchParams.get('error');
  const oauthErrorCopy = useMemo(() => inviteAcceptMessage(oauthError), [oauthError]);

  const googleStartUrl = useMemo(
    () => customerGoogleAuthStartUrl({ inviteToken: token, selectAccount: true }),
    [token],
  );

  const landingSiteUrl = useMemo(() => getLandingSiteUrl(), []);

  const googleSelectAccountUrl = useMemo(
    () => customerGoogleAuthStartUrl({ inviteToken: token, selectAccount: true }),
    [token],
  );

  const loadPreview = useCallback(async () => {
    if (!token.trim()) {
      setPreviewState({
        phase: 'error',
        title: 'Invite not found',
        message: 'This invite link is invalid or no longer available.',
        errorCode: 'workspace_invite_not_found',
      });
      return;
    }

    setPreviewState({ phase: 'loading' });
    const res = await getCustomerInvitePreview(token);
    if (res.ok) {
      setPreviewState({ phase: 'ready', preview: res.data });
      return;
    }

    const body = (res.body ?? null) as ApiErrorBody | null;
    const errorCode = body?.errorCode ?? res.errorCode ?? null;
    const mapped = inviteAcceptMessage(errorCode);
    setPreviewState({
      phase: 'error',
      title: mapped?.title ?? 'Invite unavailable',
      message: mapped?.message ?? res.error,
      errorCode,
    });
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (oauthError === 'workspace_invite_email_mismatch' && customer?.email && previewState.phase === 'ready') {
      setEmailMismatch({
        invitedEmail: previewState.preview.invitedEmail,
        currentEmail: customer.email,
      });
    }
  }, [oauthError, customer?.email, previewState]);

  const isAuthenticated = status === 'authenticated';
  const authPending = status === 'loading';
  const inviteAlreadyAccepted =
    previewState.phase === 'error' && previewState.errorCode === 'workspace_invite_already_accepted';

  useEffect(() => {
    if (inviteAlreadyAccepted && isAuthenticated && !authPending) {
      navigate(CUSTOMER_POST_LOGIN_DEST, { replace: true });
    }
  }, [inviteAlreadyAccepted, isAuthenticated, authPending, navigate]);

  const joiningWorkspace =
    acceptRedirecting ||
    acceptInFlight ||
    (inviteAlreadyAccepted && (authPending || isAuthenticated));

  async function handleAccept() {
    if (!token.trim()) return;
    setAcceptError(null);
    setEmailMismatch(null);
    setAcceptInFlight(true);
    let succeeded = false;
    try {
      const res = await postCustomerInviteAccept(token);
      if (!res.ok) {
        const body = (res.body ?? null) as ApiErrorBody | null;
        if (body?.errorCode === 'workspace_invite_email_mismatch') {
          const fallbackInvitedEmail =
            previewState.phase === 'ready' ? previewState.preview.invitedEmail : '';
          setEmailMismatch({
            invitedEmail: String(body.invitedEmail ?? fallbackInvitedEmail),
            currentEmail: String(body.currentEmail ?? customer?.email ?? ''),
          });
          return;
        }
        const mapped = inviteAcceptMessage(body?.errorCode ?? res.errorCode ?? null);
        setAcceptError(mapped?.message ?? res.error);
        return;
      }
      succeeded = true;
      setAcceptRedirecting(true);
      await refresh();
      navigate(CUSTOMER_POST_LOGIN_DEST, { replace: true });
    } finally {
      if (!succeeded) {
        setAcceptInFlight(false);
      }
    }
  }

  async function handleSignOutAndContinue() {
    await logout();
    window.location.assign(googleStartUrl);
  }

  function renderErrorState() {
    if (previewState.phase !== 'error') return null;
    if (inviteAlreadyAccepted && (authPending || isAuthenticated)) return null;

    const { errorCode, title, message } = previewState;
    const tone =
      errorCode === 'workspace_invite_expired' || errorCode === 'workspace_invite_cancelled'
        ? 'warning'
        : errorCode === 'workspace_invite_already_accepted'
          ? 'success'
          : 'neutral';

    const icon =
      errorCode === 'workspace_invite_expired' ? (
        <Clock3 className="h-6 w-6" strokeWidth={2} />
      ) : errorCode === 'workspace_invite_cancelled' ? (
        <Ban className="h-6 w-6" strokeWidth={2} />
      ) : errorCode === 'workspace_invite_already_accepted' ? (
        <Users className="h-6 w-6" strokeWidth={2} />
      ) : (
        <AlertCircle className="h-6 w-6" strokeWidth={2} />
      );

    const primaryAction =
      errorCode === 'workspace_invite_not_found' ? (
        <InvitePrimaryActions>
          <a href={landingSiteUrl} className={landingLinkClassName()}>
            Back to Assistrio
          </a>
          <Link
            to={CUSTOMER_ROUTES.login}
            className="text-center text-sm font-medium text-slate-500 no-underline hover:text-teal-700"
          >
            Go to login
          </Link>
        </InvitePrimaryActions>
      ) : (
        <InvitePrimaryActions>
          {errorCode === 'workspace_invite_already_accepted' ? (
            <GoogleSignInLink href={googleStartUrl}>Go to login</GoogleSignInLink>
          ) : (
            <Button type="button" size="lg" className="w-full" onClick={() => navigate(CUSTOMER_ROUTES.login)}>
              Go to login
            </Button>
          )}
          <a
            href={landingSiteUrl}
            className="text-center text-sm font-medium text-slate-500 no-underline hover:text-teal-700"
          >
            Back to Assistrio
          </a>
        </InvitePrimaryActions>
      );

    return (
      <InviteStatusPanel
        icon={icon}
        tone={tone}
        title={title}
        body={errorBodyMessage(errorCode, message)}
        secondaryBody={errorSecondaryMessage(errorCode)}
        actions={primaryAction}
      />
    );
  }

  if (joiningWorkspace) {
    return (
      <InviteAcceptShell>
        <InlineLoader title="Joining workspace…" className="min-h-[14rem] py-8" />
      </InviteAcceptShell>
    );
  }

  return (
    <InviteAcceptShell centered={previewState.phase !== 'ready'}>
      {previewState.phase === 'loading' ? (
        <InlineLoader title="Checking invitation…" className="min-h-[14rem] py-8" />
      ) : null}

      {renderErrorState()}

      {previewState.phase === 'ready' ? (
        <div className="text-left">
          {oauthErrorCopy ? (
            <div
              className="mb-5 rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 text-[var(--color-danger-text)]"
              role="alert"
            >
              <p className="mb-0 text-sm font-semibold">{oauthErrorCopy.title}</p>
              <p className="mb-0 mt-1 text-sm leading-relaxed">{oauthErrorCopy.message}</p>
            </div>
          ) : null}

          <InviteWorkspaceBadge />

          <InviteValidHeading>You&apos;re invited to join</InviteValidHeading>

          <div className="mt-5">
            <InviteWorkspaceSummary
              workspaceName={previewState.preview.workspaceName}
              roleLabel={workspaceRoleLabel(previewState.preview.role)}
              invitedBy={previewState.preview.inviterName ?? 'A workspace admin'}
              expiresAt={formatExpiry(previewState.preview.expiresAt)}
            />
          </div>

          {emailMismatch ? (
            <div
              className="mt-5 rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 text-[var(--color-danger-text)]"
              role="alert"
            >
              <p className="mb-0 text-sm leading-relaxed">
                This invite was sent to <strong>{emailMismatch.invitedEmail}</strong>. You are signed in as{' '}
                <strong>{emailMismatch.currentEmail}</strong>.
              </p>
            </div>
          ) : null}

          {acceptError ? (
            <p className="mt-4 text-sm text-[var(--color-danger-text)]" role="alert">
              {acceptError}
            </p>
          ) : null}

          <div className="mt-8 space-y-3">
            <InviteCtaBlock>
              {authPending ? (
                <div
                  className="flex h-10 w-full items-center justify-center"
                  role="status"
                  aria-live="polite"
                  aria-label="Checking your account"
                >
                  <PageLoaderSpinner size="compact" decorative />
                </div>
              ) : !isAuthenticated ? (
                <>
                  <GoogleSignInLink href={googleStartUrl} />
                  <p className="mb-0 mt-2 text-center text-[0.6875rem] leading-relaxed text-slate-400">
                    Use the email address this invite was sent to.
                  </p>
                </>
              ) : emailMismatch ? (
                <GoogleSignInButton
                  type="button"
                  className="w-full"
                  onClick={() => void handleSignOutAndContinue()}
                  disabled={logoutInFlight}
                >
                  Sign out and continue with Google
                </GoogleSignInButton>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => void handleAccept()}
                  disabled={acceptInFlight}
                  aria-busy={acceptInFlight}
                >
                  {acceptInFlight ? (
                    <span className="inline-flex items-center gap-2">
                      <PageLoaderSpinner size="compact" decorative />
                      Accepting…
                    </span>
                  ) : (
                    'Accept invitation'
                  )}
                </Button>
              )}

              {!authPending ? <InviteLegalNotice className="!mt-3" /> : null}
            </InviteCtaBlock>

            {isAuthenticated && !emailMismatch && !authPending ? (
              <p className="text-center">
                <a
                  href={googleSelectAccountUrl}
                  className="text-sm font-medium text-slate-500 no-underline hover:text-teal-700"
                >
                  Use a different account
                </a>
              </p>
            ) : null}

            <InviteSupportLink className="text-center" />
          </div>
        </div>
      ) : null}
    </InviteAcceptShell>
  );
}
