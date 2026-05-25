import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { customerGoogleAuthStartUrl } from '../api/client';
import { getCustomerInvitePreview, postCustomerInviteAccept } from '../api/customerApi';
import type { ApiErrorBody, CustomerInvitePreview } from '../api/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { workspaceRoleLabel } from '../lib/workspaceRoles';
import { CUSTOMER_POST_LOGIN_DEST } from '../routes/customerRoutes';

type PreviewState =
  | { phase: 'loading' }
  | { phase: 'ready'; preview: CustomerInvitePreview }
  | { phase: 'error'; title: string; message: string };

function inviteErrorMessage(code: string | null): { title: string; message: string } | null {
  switch (code) {
    case 'workspace_invite_not_found':
      return { title: 'Invite not found', message: 'This invite link is invalid or no longer exists.' };
    case 'workspace_invite_expired':
      return { title: 'Invite expired', message: 'This invite has expired. Ask the workspace admin for a new invite.' };
    case 'workspace_invite_cancelled':
      return { title: 'Invite cancelled', message: 'This invite was cancelled by the workspace admin.' };
    case 'workspace_invite_already_accepted':
      return { title: 'Invite already used', message: 'This invite has already been accepted.' };
    case 'workspace_invite_email_mismatch':
      return {
        title: 'Wrong Google account',
        message: 'Sign in with the Google account that received this invite.',
      };
    default:
      return null;
  }
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function InviteAcceptPage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { status, customer, refresh, logout, logoutInFlight } = useCustomerAuth();
  const [previewState, setPreviewState] = useState<PreviewState>({ phase: 'loading' });
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptInFlight, setAcceptInFlight] = useState(false);
  const [emailMismatch, setEmailMismatch] = useState<{ invitedEmail: string; currentEmail: string } | null>(
    null,
  );

  const oauthError = searchParams.get('error');
  const oauthErrorCopy = useMemo(() => inviteErrorMessage(oauthError), [oauthError]);

  const googleStartUrl = useMemo(
    () => customerGoogleAuthStartUrl({ inviteToken: token, selectAccount: true }),
    [token],
  );

  const loadPreview = useCallback(async () => {
    if (!token.trim()) {
      setPreviewState({
        phase: 'error',
        title: 'Invite not found',
        message: 'This invite link is invalid.',
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
    const mapped = inviteErrorMessage(body?.errorCode ?? null);
    setPreviewState({
      phase: 'error',
      title: mapped?.title ?? 'Invite unavailable',
      message: mapped?.message ?? res.error,
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

  async function handleAccept() {
    if (!token.trim()) return;
    setAcceptError(null);
    setEmailMismatch(null);
    setAcceptInFlight(true);
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
        const mapped = inviteErrorMessage(body?.errorCode ?? res.errorCode ?? null);
        setAcceptError(mapped?.message ?? res.error);
        return;
      }
      await refresh();
      navigate(CUSTOMER_POST_LOGIN_DEST, { replace: true });
    } finally {
      setAcceptInFlight(false);
    }
  }

  async function handleSignOutAndContinue() {
    await logout();
    window.location.assign(googleStartUrl);
  }

  const isAuthenticated = status === 'authenticated';

  return (
    <div
      className="flex min-h-svh items-center justify-center p-6"
      style={{ background: 'linear-gradient(180deg,#f0fbf9 0%,#f4f6f8 42%)' }}
    >
      <div className="w-full max-w-[480px] rounded-xl border border-slate-200 bg-white p-8 shadow-[var(--shadow-lg)]">
        <div className="mb-5 leading-none">
          <img
            src="/logo-text.png"
            alt="Assistrio"
            width={180}
            height={33}
            className="block h-7 w-auto max-w-full object-contain object-left"
            decoding="async"
          />
        </div>

        <h1 className="mb-2 mt-0 text-2xl tracking-tight text-slate-900">Workspace invite</h1>

        {oauthErrorCopy && previewState.phase !== 'error' ? (
          <div
            className="mb-5 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-[0.85rem_1rem] text-[var(--color-danger-text)]"
            role="alert"
          >
            <p className="mb-0 text-[0.875rem] leading-[1.45] font-semibold">{oauthErrorCopy.title}</p>
            <p className="mb-0 mt-1 text-[0.875rem] leading-[1.45]">{oauthErrorCopy.message}</p>
          </div>
        ) : null}

        {previewState.phase === 'loading' ? (
          <p className="text-[0.9375rem] text-slate-500">Loading invite…</p>
        ) : null}

        {previewState.phase === 'error' ? (
          <div role="alert">
            <p className="mb-1 text-[0.9375rem] font-semibold text-slate-900">{previewState.title}</p>
            <p className="mb-0 text-[0.9375rem] leading-[1.5] text-slate-500">{previewState.message}</p>
          </div>
        ) : null}

        {previewState.phase === 'ready' ? (
          <div className="space-y-4">
            <p className="text-[0.9375rem] leading-[1.5] text-slate-600">
              You&apos;ve been invited to join <strong>{previewState.preview.workspaceName}</strong> as a{' '}
              <strong>{workspaceRoleLabel(previewState.preview.role)}</strong>.
            </p>
            <dl className="grid gap-2 text-[0.875rem] text-slate-600">
              <div>
                <dt className="font-medium text-slate-500">Invited email</dt>
                <dd>{previewState.preview.invitedEmail}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Expires</dt>
                <dd>{formatExpiry(previewState.preview.expiresAt)}</dd>
              </div>
              {previewState.preview.inviterName || previewState.preview.inviterEmail ? (
                <div>
                  <dt className="font-medium text-slate-500">Invited by</dt>
                  <dd>
                    {previewState.preview.inviterName ?? previewState.preview.inviterEmail}
                    {previewState.preview.inviterName && previewState.preview.inviterEmail
                      ? ` (${previewState.preview.inviterEmail})`
                      : null}
                  </dd>
                </div>
              ) : null}
            </dl>

            {emailMismatch ? (
              <div
                className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-[0.85rem_1rem] text-[var(--color-danger-text)]"
                role="alert"
              >
                <p className="mb-0 text-[0.875rem] leading-[1.45]">
                  This invite was sent to <strong>{emailMismatch.invitedEmail}</strong>. You are signed in as{' '}
                  <strong>{emailMismatch.currentEmail}</strong>.
                </p>
              </div>
            ) : null}

            {acceptError ? (
              <p className="text-[0.875rem] text-[var(--color-danger-text)]" role="alert">
                {acceptError}
              </p>
            ) : null}

            {!isAuthenticated ? (
              <a
                href={googleStartUrl}
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[0.9375rem] font-semibold text-white no-underline hover:bg-primary/90"
              >
                Continue with Google
              </a>
            ) : emailMismatch ? (
              <button
                type="button"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[0.9375rem] font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                onClick={() => void handleSignOutAndContinue()}
                disabled={logoutInFlight}
              >
                Sign out and continue with Google
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[0.9375rem] font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                onClick={() => void handleAccept()}
                disabled={acceptInFlight}
              >
                {acceptInFlight ? 'Accepting…' : 'Accept invite'}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
