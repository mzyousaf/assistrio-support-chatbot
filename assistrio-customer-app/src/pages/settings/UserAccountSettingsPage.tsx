import { LifeBuoy, LogOut, Shield, User } from 'lucide-react';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { useCustomerLogout } from '@/auth/useCustomerLogout';
import { SettingsCopyButton } from '@/components/settings/SettingsCopyButton';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { SettingsInfoRow } from '@/components/settings/SettingsInfoRow';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { settingsNavButtonClassName } from '@/components/settings/settingsNavButtonClassName';
import { Button } from '@/components/ui';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';

function GoogleAccountBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#4285F4] ring-1 ring-slate-200">
        G
      </span>
      Google account
    </span>
  );
}

function CustomerRoleBadge({ role }: { role: string | null | undefined }) {
  const label = role?.trim() ? role.charAt(0).toUpperCase() + role.slice(1) : 'Customer';
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
      {label}
    </span>
  );
}

export function UserAccountSettingsPage() {
  const { customer, refresh, bootstrapError } = useCustomerAuth();
  const { signOut, logoutInFlight } = useCustomerLogout();

  const email = customer?.email?.trim() || '—';
  const accountId = customer?.id?.trim() || '';
  const displayName = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim();

  return (
    <>
      <SettingsPageHeader
        title="User Account"
        description="Your personal sign-in profile. Workspace billing and collaboration live on the Workspace page."
      />

      <WorkspaceContentContainer size="standard" className="pt-6">
        <div className="flex flex-col gap-4">
          {bootstrapError ? (
            <div className="rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning-text)]">
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

          <SettingsInfoCard
            id="settings-profile"
            icon={User}
            title="Profile"
            description="Information tied to your Assistrio login."
          >
            <div className="space-y-0">
              {displayName ? <SettingsInfoRow label="Name" value={displayName} /> : null}
              <SettingsInfoRow label="Email" value={email} />
              {accountId ? (
                <SettingsInfoRow
                  label="Account ID"
                  value={
                    <span className="inline-flex flex-wrap items-center justify-end gap-2 sm:justify-end">
                      <code className="font-mono text-[0.8125rem] text-slate-800">{accountId}</code>
                      <SettingsCopyButton value={accountId} label="ID" />
                    </span>
                  }
                />
              ) : null}
              <SettingsInfoRow label="Account type" value={<CustomerRoleBadge role={customer?.role} />} />
              <SettingsInfoRow label="Sign-in provider" value={<GoogleAccountBadge />} />
            </div>
          </SettingsInfoCard>

          <SettingsInfoCard
            id="settings-sign-in"
            icon={Shield}
            title="Sign-in"
            description="Assistrio uses Google for authentication."
            action={
              <Button type="button" variant="secondary" size="sm" disabled title="Managed through Google">
                Manage Google access
              </Button>
            }
          >
            <p className="m-0 text-sm leading-relaxed text-slate-600">
              You use <strong className="font-semibold text-slate-800">Google</strong> to access Assistrio. There is
              no separate Assistrio password.
            </p>
            <p className="m-0 mt-2 text-sm leading-relaxed text-slate-500">
              If your session expires, sign in again from the login page with the same Google account.
            </p>
          </SettingsInfoCard>

          <SettingsInfoCard
            id="settings-session"
            icon={LogOut}
            title="Session"
            description="Sign out on this browser only."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={logoutInFlight}
                onClick={() => void signOut()}
              >
                {logoutInFlight ? 'Signing out…' : 'Sign out'}
              </Button>
            }
          >
            <p className="m-0 text-sm leading-relaxed text-slate-600">
              This signs you out on <strong className="font-semibold text-slate-800">this browser only</strong>. Other
              devices stay signed in until their sessions end.
            </p>
          </SettingsInfoCard>

          <SettingsInfoCard
            id="settings-help"
            icon={LifeBuoy}
            title="Help"
            description="Need access for a teammate or locked out after an email change?"
            variant="muted"
            action={
              <a href="mailto:support@assistrio.com?subject=Assistrio%20support" className={settingsNavButtonClassName('secondary')}>
                Contact support
              </a>
            }
          >
            <p className="m-0 text-sm leading-relaxed text-slate-600">
              Contact whoever manages Assistrio for your organization, or email Assistrio support with the Google email
              you use to sign in.
            </p>
          </SettingsInfoCard>
        </div>
      </WorkspaceContentContainer>
    </>
  );
}
