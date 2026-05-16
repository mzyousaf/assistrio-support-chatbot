import { useLayoutEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { readAndClearCustomerSessionEndedBanner } from '../api/customerSessionUnauthorized';
import { customerGoogleAuthStartUrl } from '../api/client';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { oauthLoginErrorMessage } from '../lib/oauthLoginErrors';

export function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sessionInvalidatedByApi, clearSessionInvalidatedByApi } = useCustomerAuth();
  const [sessionEndedOpen, setSessionEndedOpen] = useState(false);
  const startUrl = customerGoogleAuthStartUrl();

  const oauthCode = searchParams.get('oauth_error');
  const oauthMessage = useMemo(() => oauthLoginErrorMessage(oauthCode), [oauthCode]);

  useLayoutEffect(() => {
    const fromReload = readAndClearCustomerSessionEndedBanner();
    if (fromReload || sessionInvalidatedByApi) setSessionEndedOpen(true);
  }, [sessionInvalidatedByApi]);

  function dismissOAuthError() {
    const next = new URLSearchParams(searchParams);
    next.delete('oauth_error');
    setSearchParams(next, { replace: true });
  }

  function dismissSessionEnded() {
    setSessionEndedOpen(false);
    clearSessionInvalidatedByApi();
  }

  return (
    <div
      className="flex min-h-svh items-center justify-center p-6"
      style={{ background: 'linear-gradient(180deg,#f0fbf9 0%,#f4f6f8 42%)' }}
    >
      <div className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-white p-8 shadow-[var(--shadow-lg)]">
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

        <h1 className="mb-2 mt-0 text-2xl tracking-tight text-slate-900">Sign in</h1>
        <p className="mb-6 text-[0.9375rem] leading-[1.5] text-slate-400">
          Use your Google account to open your Assistrio workspace. Your session stays secure with a
          cookie from our API.
        </p>

        {sessionEndedOpen ? (
          <div
            className="mb-5 rounded-lg border border-[var(--color-info-muted-border)] bg-[var(--color-info-muted-bg)] p-[0.85rem_1rem] text-[var(--color-info-muted-text)]"
            role="status"
          >
            <p className="mb-[0.65rem] text-[0.875rem] leading-[1.45]">
              Your session ended. Please sign in again to continue.
            </p>
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent p-0 text-[0.8125rem] font-semibold text-[var(--color-info-accent-text)] underline hover:text-primary"
              onClick={dismissSessionEnded}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {oauthMessage ? (
          <div
            className="mb-5 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-[0.85rem_1rem] text-[var(--color-danger-text)]"
            role="alert"
          >
            <p className="mb-[0.65rem] text-[0.875rem] leading-[1.45]">{oauthMessage}</p>
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent p-0 text-[0.8125rem] font-semibold text-[var(--color-danger-text-emphasis)] underline hover:text-[var(--color-danger-text)]"
              onClick={dismissOAuthError}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <a
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-[0.65rem] text-[0.9375rem] font-semibold text-white no-underline shadow-[var(--shadow-primary-fill)] transition-colors duration-100 hover:bg-[var(--teal-800)]"
          href={startUrl}
        >
          Continue with Google
        </a>

        <p className="mb-0 mt-4 text-[0.8125rem] leading-[1.4] text-slate-300">
          First time here? You'll finish a quick setup after you sign in.
        </p>

        <Link
          to="/"
          className="mt-5 inline-block text-[0.875rem] text-primary no-underline hover:text-[var(--teal-800)]"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
