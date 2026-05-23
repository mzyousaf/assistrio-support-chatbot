import { useId, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { useCustomerLogout } from '@/auth/useCustomerLogout';
import { customerInitials } from '@/lib/customerDisplay';
import type { CustomerMe } from '@/api/types';
import { cn } from '@/lib/utils';

function onboardingWorkspaceLabel(customer: CustomerMe | null): string {
  if (!customer) return 'My workspace';
  const list = customer.workspaces;
  if (list && list.length === 1) return list[0].name?.trim() || 'My workspace';
  if (list && list.length > 1) {
    const first = list[0].name?.trim() || 'Workspace';
    return `${first} (+${list.length - 1})`;
  }
  const fn = customer.firstName?.trim();
  const ln = customer.lastName?.trim();
  if (fn && ln) return `${fn} ${ln}'s workspace`;
  if (fn) return `${fn}'s workspace`;
  return 'My workspace';
}

function accountDisplayName(customer: CustomerMe | null): string {
  if (!customer) return 'Account';
  const n = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
  if (n) return n;
  return customer.email?.split('@')[0]?.trim() || 'Account';
}

function AccountAvatar({
  picture,
  initials,
  imgFailed,
  onError,
  size = 'sm',
}: {
  picture?: string;
  initials: string;
  imgFailed: boolean;
  onError: () => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-7 w-7 text-[0.6rem]' : 'h-8 w-8 text-[0.65rem]';
  if (picture && !imgFailed) {
    return (
      <img
        src={picture}
        alt=""
        className={cn('block shrink-0 rounded-full object-cover ring-2 ring-white', dim)}
        onError={onError}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 font-bold text-white',
        dim,
      )}
    >
      {initials}
    </span>
  );
}

/**
 * Focused top bar for first-time onboarding — branding and account only, no dashboard nav.
 */
export function OnboardingTopNavbar() {
  const menuId = useId();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const { customer } = useCustomerAuth();
  const { signOut, logoutInFlight, logoutError, clearLogoutError } = useCustomerLogout();
  const [imgFailed, setImgFailed] = useState(false);

  const initials = customer ? customerInitials(customer) : '?';
  const profileName = accountDisplayName(customer);
  const profileEmail = customer?.email?.trim() ?? '';
  const workspaceName = onboardingWorkspaceLabel(customer);

  const closeMenu = () => {
    menuRef.current?.removeAttribute('open');
  };

  const handleSignOut = () => {
    void signOut({ beforeNavigate: closeMenu });
  };

  return (
    <header
      className="sticky top-0 z-40 shrink-0"
      style={{
        height: 'var(--nav-height)',
        background: 'var(--bg-navbar)',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <div className="flex h-full w-full items-center justify-between gap-4 px-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <div
            className="flex shrink-0 items-center gap-2 leading-none"
            aria-label="Assistrio"
          >
            <img
              src="/logo-180x180.png"
              alt=""
              width={180}
              height={180}
              className="block size-7 object-contain"
              decoding="async"
            />
            <span className="hidden text-[0.8125rem] font-semibold tracking-tight text-[var(--color-text-primary)] sm:inline">
              Assistrio
            </span>
          </div>

          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="shrink-0 text-[0.8125rem] text-[var(--color-text-muted)]" aria-hidden>
              /
            </span>
            <span className="shrink-0 text-[0.8125rem] font-medium text-[var(--color-text-secondary)]">
              Agent setup
            </span>
            <span className="shrink-0 text-[0.8125rem] text-[var(--color-text-muted)]" aria-hidden>
              /
            </span>
            <span
              className="min-w-0 max-w-[16rem] truncate text-[0.8125rem] font-medium text-[var(--color-text-primary)]"
              title={workspaceName}
            >
              {workspaceName}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {logoutError ? (
            <div
              className="hidden max-w-[16rem] items-center gap-2 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-2.5 py-1 text-xs text-[var(--color-danger-text)] sm:flex"
              role="alert"
            >
              <span className="truncate">{logoutError}</span>
              <button
                type="button"
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[var(--color-danger-text)] underline"
                onClick={clearLogoutError}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
            disabled={logoutInFlight}
            onClick={handleSignOut}
          >
            {logoutInFlight ? 'Signing out…' : 'Sign out'}
          </button>

          <details
            ref={menuRef}
            className="relative hidden sm:block [&[open]_.chevron]:rotate-180"
            onToggle={(e) => {
              if (e.currentTarget.open) clearLogoutError();
            }}
          >
            <summary
              className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors duration-150 nav-hover [&::-webkit-details-marker]:hidden"
              aria-label="Account menu"
              aria-controls={menuId}
            >
              <AccountAvatar
                picture={customer?.picture}
                initials={initials}
                imgFailed={imgFailed}
                onError={() => setImgFailed(true)}
                size="sm"
              />
              <ChevronDown
                className="chevron shrink-0 text-slate-400 transition-transform duration-150"
                size={13}
                strokeWidth={2.1}
                aria-hidden
              />
            </summary>

            <div
              id={menuId}
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl bg-white shadow-[var(--shadow-panel)]"
              style={{ border: '1px solid var(--border-soft)' }}
              role="menu"
            >
              <div
                className="flex items-center gap-3 px-3.5 py-3"
                style={{
                  background:
                    'linear-gradient(135deg,color-mix(in srgb,#14b8a6 7%,transparent) 0%,transparent 70%),white',
                }}
              >
                <AccountAvatar
                  picture={customer?.picture}
                  initials={initials}
                  imgFailed={imgFailed}
                  onError={() => setImgFailed(true)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                    {profileName}
                  </p>
                  {profileEmail ? (
                    <p className="truncate text-xs text-slate-400">{profileEmail}</p>
                  ) : null}
                </div>
              </div>

              <div className="h-px bg-slate-200" role="separator" />

              <div className="p-1.5">
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none bg-transparent px-2.5 py-1.5 text-left font-[inherit] text-sm font-medium text-red-600 transition-colors duration-150 hover:enabled:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  role="menuitem"
                  disabled={logoutInFlight}
                  onClick={handleSignOut}
                >
                  <LogOut size={15} strokeWidth={1.75} className="shrink-0" aria-hidden />
                  {logoutInFlight ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
