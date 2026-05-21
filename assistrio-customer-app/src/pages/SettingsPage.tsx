import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useCustomerLogout } from '../auth/useCustomerLogout';
import { DataPageLayout } from '../layout/workspace-layout';

export function SettingsPage() {
  const { customer, refresh, bootstrapError } = useCustomerAuth();
  const { signOut, logoutInFlight } = useCustomerLogout();

  const email = customer?.email?.trim() || '—';
  const workspaceCount = customer?.workspaceIds?.length ?? 0;

  return (
    <DataPageLayout
      title="Account"
      description="Your workspace profile. Sign-in is managed through Google."
      containerSize="standard"
    >
      <div className="flex flex-col gap-5">
        {bootstrapError ? (
          <div className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-[0.85rem] text-[0.9375rem] text-[var(--color-warning-text)]">
            {bootstrapError}{' '}
            <button
              type="button"
              className="ml-1 cursor-pointer border-none bg-none p-0 font-semibold text-[var(--color-warning-strong-text)] underline"
              onClick={() => void refresh()}
            >
              Retry
            </button>
          </div>
        ) : null}

        <section
          className="rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]"
          aria-labelledby="settings-profile-heading"
        >
          <h2 id="settings-profile-heading" className="mb-3 mt-0 text-base font-semibold tracking-tight text-slate-900">
            Profile
          </h2>
          <dl className="m-0">
            {[
              { label: 'Email', value: email },
              customer?.id ? { label: 'Account ID', value: <code className="font-mono text-[0.8125rem]">{customer.id}</code> } : null,
              { label: 'Role', value: <span className="capitalize">{customer?.role?.trim() || 'customer'}</span> },
            ].filter(Boolean).map((row, i, arr) => (
              <div
                key={i}
                className={`grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 px-0 py-2 text-[0.9375rem] max-[520px]:grid-cols-1 ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}
              >
                <dt className="m-0 font-medium text-slate-400">{row!.label}</dt>
                <dd className="m-0 break-words text-slate-900">{row!.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]"
          aria-labelledby="settings-auth-heading"
        >
          <h2 id="settings-auth-heading" className="mb-3 mt-0 text-base font-semibold tracking-tight text-slate-900">
            Sign-in
          </h2>
          <p className="mb-[0.65rem] text-[0.9375rem] leading-[1.5] text-slate-400 last:mb-0">
            You use <strong>Google</strong> to access Assistrio. We keep you signed in with a secure
            session cookie from our API (no separate Assistrio password).
          </p>
          <p className="mb-0 text-[0.9375rem] leading-[1.5] text-slate-400">
            If your session expires, you'll be asked to sign in with Google again from the login page.
          </p>
        </section>

        <section
          className="rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]"
          aria-labelledby="settings-workspaces-heading"
        >
          <h2 id="settings-workspaces-heading" className="mb-3 mt-0 text-base font-semibold tracking-tight text-slate-900">
            Workspaces
          </h2>
          <p className="m-0 text-[0.9375rem] leading-[1.5] text-slate-400">
            {workspaceCount === 0
              ? 'No workspace ids were returned for this account yet. If something looks wrong, try refreshing or contact support.'
              : workspaceCount === 1
                ? 'You have access to 1 workspace. Assistants and knowledge belong to that workspace.'
                : `You have access to ${workspaceCount} workspaces. Assistants and knowledge are scoped to these workspaces.`}
          </p>
        </section>

        <section
          className="rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]"
          aria-labelledby="settings-session-heading"
        >
          <h2 id="settings-session-heading" className="mb-3 mt-0 text-base font-semibold tracking-tight text-slate-900">
            Session
          </h2>
          <p className="mb-[0.65rem] text-[0.9375rem] leading-[1.5] text-slate-400">
            Sign out on this browser. Other devices are not affected.
          </p>
          <button
            type="button"
            className="mt-[0.35rem] cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-[0.875rem] font-semibold text-slate-600 transition-colors duration-100 hover:enabled:border-slate-400 hover:enabled:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-65"
            disabled={logoutInFlight}
            onClick={() => void signOut()}
          >
            {logoutInFlight ? 'Signing out…' : 'Sign out'}
          </button>
        </section>

        <section
          className="rounded-[0.625rem] border border-slate-100 bg-slate-50 p-[1.15rem_1.35rem]"
          aria-labelledby="settings-help-heading"
        >
          <h2 id="settings-help-heading" className="mb-2 mt-0 text-[0.9375rem] font-semibold text-slate-600">
            Help
          </h2>
          <p className="m-0 text-[0.875rem] leading-[1.45] text-slate-400">
            Need access for a teammate or locked out after an email change? Contact whoever manages
            Assistrio for your organization, or reach out to Assistrio support with the email you use
            to sign in.
          </p>
        </section>
      </div>
    </DataPageLayout>
  );
}
