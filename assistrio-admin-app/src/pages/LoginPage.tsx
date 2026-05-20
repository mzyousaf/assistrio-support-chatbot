import { useLayoutEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readAndClearAdminSessionEndedBanner } from '../api/adminSessionUnauthorized';
import { loginAdmin } from '../api/adminApi';
import { useAdminAuth } from '../auth/AdminAuthContext';
import { AssistrioLogo } from '@/components/AssistrioLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

function safePostLoginPath(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/customers';
  if (from === '/login') return '/customers';
  return from;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh, sessionInvalidatedByApi, clearSessionInvalidatedByApi } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionEndedOpen, setSessionEndedOpen] = useState(false);

  useLayoutEffect(() => {
    const fromReload = readAndClearAdminSessionEndedBanner();
    if (fromReload || sessionInvalidatedByApi) setSessionEndedOpen(true);
  }, [sessionInvalidatedByApi]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    const res = await loginAdmin(trimmedEmail, password);
    if (!res.ok) {
      setSubmitting(false);
      setError(res.error || 'Sign in failed.');
      return;
    }
    await refresh();
    setSubmitting(false);
    const state = location.state as { from?: string } | null;
    navigate(safePostLoginPath(state?.from), { replace: true });
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
          <AssistrioLogo wordmarkClassName="h-7 w-auto max-w-full object-contain object-left" />
        </div>

        <h1 className="mb-2 mt-0 text-2xl tracking-tight text-slate-900">Admin sign in</h1>
        <p className="mb-6 text-[0.9375rem] leading-[1.5] text-slate-400">
          Platform administrator access only. Your session is stored in a secure cookie from our API.
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

        {error ? (
          <div
            className="mb-5 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-[0.85rem_1rem] text-[0.875rem] text-[var(--color-danger-text)]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div>
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
