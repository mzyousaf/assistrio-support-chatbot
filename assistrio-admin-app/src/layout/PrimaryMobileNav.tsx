import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIMARY_NAV, type PrimaryNavEntry } from './primaryNav';

type FlatNavItem = {
  to: string;
  label: string;
  icon: typeof BarChart3;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

function flattenPrimaryNav(entries: PrimaryNavEntry[]): FlatNavItem[] {
  const flat: FlatNavItem[] = [];
  for (const entry of entries) {
    if (entry.kind === 'group') {
      for (const child of entry.children) {
        flat.push({
          to: child.to,
          label: child.label,
          icon: entry.icon,
          end: child.end ?? true,
          isActive: child.isActive,
        });
      }
    } else {
      flat.push({
        to: entry.to,
        label: entry.label,
        icon: entry.icon,
        end: entry.end,
        isActive: entry.isActive,
      });
    }
  }
  return flat;
}

const MOBILE_NAV = flattenPrimaryNav(PRIMARY_NAV);

/** Horizontal primary nav for viewports where the sidebar is hidden. */
export function PrimaryMobileNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--bg-sidebar-primary)] px-2 py-2 md:hidden"
      aria-label="Admin navigation"
    >
      {MOBILE_NAV.map((item) => {
        const { to, label, icon: Icon, end } = item;
        const active =
          item.isActive != null
            ? item.isActive(pathname)
            : end
              ? pathname === to
              : pathname === to || pathname.startsWith(`${to}/`);
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium no-underline whitespace-nowrap',
              active
                ? 'bg-[var(--active-soft)] text-[var(--active-text)]'
                : 'text-slate-600 hover:bg-[var(--hover-soft)] hover:text-slate-900',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
