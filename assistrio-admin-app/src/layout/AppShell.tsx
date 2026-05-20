import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AssistrioLogo } from '@/components/AssistrioLogo';
import { useAdminAuth } from '../auth/AdminAuthContext';
import { cn } from '@/lib/utils';
import { getAdminSectionLabel } from './adminPageLabel';
import { PrimaryMobileNav } from './PrimaryMobileNav';
import { PrimarySidebarNav } from './PrimarySidebarNav';
import { shouldCollapsePrimarySidebar } from './primaryNav';

function accountLabel(email: string | undefined): string {
  if (!email) return 'Admin';
  return email.split('@')[0]?.trim() || 'Admin';
}

export function AppShell() {
  const { admin, logout, logoutInFlight } = useAdminAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const collapsePrimary = shouldCollapsePrimarySidebar(pathname);
  const sectionLabel = getAdminSectionLabel(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const handleLogout = useCallback(async () => {
    setMenuOpen(false);
    const ok = await logout();
    if (ok) navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <div className="flex min-h-svh flex-col bg-[var(--bg-app)]">
      <header
        className="sticky top-0 z-40 flex h-[var(--nav-height)] shrink-0 items-center gap-4 border-b border-[var(--border-soft)] bg-[var(--bg-navbar)] px-4 shadow-[var(--shadow-xs)] sm:px-6"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <NavLink
            to="/customers"
            className="flex shrink-0 items-center rounded-lg no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-600)]/40"
            aria-label="Assistrio admin home"
          >
            <AssistrioLogo wordmarkClassName="h-[1.125rem] w-auto max-w-[7.25rem] object-contain object-left" />
          </NavLink>
          <span
            className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block"
            aria-hidden
          />
          <span className="hidden shrink-0 rounded-md bg-[var(--teal-50)] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--teal-800)] sm:inline">
            Admin
          </span>
          {sectionLabel ? (
            <>
              <span className="hidden shrink-0 text-slate-300 sm:inline" aria-hidden>
                /
              </span>
              <span className="hidden truncate text-[0.8125rem] font-medium text-slate-600 sm:inline">
                {sectionLabel}
              </span>
            </>
          ) : null}
        </div>

        <div ref={menuRef} className="relative ml-auto shrink-0">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-white px-2.5 py-1.5 text-[0.8125rem] font-medium text-slate-700 transition-colors hover:bg-[var(--hover-soft)]"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span
              className="flex size-7 items-center justify-center rounded-full bg-[var(--teal-100)] text-[0.75rem] font-semibold text-[var(--teal-800)]"
              aria-hidden
            >
              {(admin?.email?.[0] ?? 'A').toUpperCase()}
            </span>
            <span className="hidden max-w-[11rem] truncate sm:inline">
              {admin?.email ?? accountLabel(admin?.email)}
            </span>
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', menuOpen && 'rotate-180')} />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-1.5 min-w-[12.5rem] rounded-lg border border-[var(--border-soft)] bg-white py-1 shadow-[var(--shadow-dropdown)]"
            >
              {admin?.email ? (
                <p className="m-0 truncate px-3 py-2 text-[0.75rem] text-slate-500">{admin.email}</p>
              ) : null}
              <NavLink
                to="/settings/account"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-[0.8125rem] text-slate-700 no-underline hover:bg-[var(--hover-soft)]"
                onClick={() => setMenuOpen(false)}
              >
                <User size={15} aria-hidden />
                Account settings
              </NavLink>
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-[0.8125rem] text-slate-700 hover:bg-[var(--hover-soft)] disabled:opacity-50"
                disabled={logoutInFlight}
                onClick={() => void handleLogout()}
              >
                <LogOut size={15} aria-hidden />
                {logoutInFlight ? 'Signing out…' : 'Logout'}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar-primary)] transition-[width] duration-200 md:flex',
            collapsePrimary ? 'w-14' : 'w-[var(--sidebar-width)]',
          )}
          aria-label="Admin navigation"
        >
          <PrimarySidebarNav collapsePrimary={collapsePrimary} />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PrimaryMobileNav />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
