import type { LucideIcon } from 'lucide-react';
import { BarChart3, Bot, Code2, Contact, Footprints, Server, Settings, Sparkles, User } from 'lucide-react';

export type PrimaryNavChild = {
  to: string;
  label: string;
  icon?: LucideIcon;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

export type PrimaryNavLink = {
  kind: 'link';
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

export type PrimaryNavGroup = {
  kind: 'group';
  id: string;
  label: string;
  icon: LucideIcon;
  defaultTo: string;
  isActive?: (pathname: string) => boolean;
  children: PrimaryNavChild[];
};

export type PrimaryNavEntry = PrimaryNavLink | PrimaryNavGroup;

export const PRIMARY_NAV: PrimaryNavEntry[] = [
  { kind: 'link', to: '/customers', label: 'Customers', icon: Contact },
  {
    kind: 'link',
    to: '/bots',
    label: 'Bots',
    icon: Bot,
    isActive: (pathname) => pathname === '/bots' || /^\/bots\/[^/]+/.test(pathname),
  },
  {
    kind: 'link',
    to: '/admin-bots',
    label: 'Admin bots',
    icon: Sparkles,
    isActive: (pathname) => pathname === '/admin-bots' || pathname.startsWith('/admin-bots/'),
  },
  {
    kind: 'group',
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    defaultTo: '/insights/platform-analytics',
    isActive: (pathname) => pathname === '/insights' || pathname.startsWith('/insights/'),
    children: [
      {
        to: '/insights/platform-analytics',
        label: 'Platform analytics',
        icon: BarChart3,
        isActive: (pathname) =>
          pathname === '/insights/platform-analytics' ||
          pathname.startsWith('/insights/platform-analytics/'),
      },
      {
        to: '/insights/marketing-visitors',
        label: 'Marketing visitors',
        icon: Footprints,
        end: false,
        isActive: (pathname) => pathname.startsWith('/insights/marketing-visitors'),
      },
    ],
  },
  {
    kind: 'group',
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    defaultTo: '/settings/account',
    isActive: (pathname) => pathname === '/settings' || pathname.startsWith('/settings/'),
    children: [
      { to: '/settings/account', label: 'Account', icon: User, end: true },
      { to: '/settings/system', label: 'System', icon: Server, end: true },
      { to: '/settings/developer', label: 'Developer', icon: Code2, end: true },
    ],
  },
];

/** Collapse primary to icons only on customer/bot workspace pages (not Admin bots / Insights / Settings). */
export function shouldCollapsePrimarySidebar(pathname: string): boolean {
  if (/^\/customers\/[^/]+/.test(pathname)) return true;
  if (pathname.startsWith('/bots/')) return true;
  return false;
}

export function isPrimaryNavEntryActive(entry: PrimaryNavEntry, pathname: string): boolean {
  if (entry.kind === 'group') {
    if (entry.isActive) return entry.isActive(pathname);
    return pathname === entry.defaultTo || pathname.startsWith(`${entry.defaultTo}/`);
  }
  if (entry.isActive) return entry.isActive(pathname);
  if (entry.end) return pathname === entry.to;
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`);
}

export function isPrimaryNavChildActive(child: PrimaryNavChild, pathname: string): boolean {
  if (child.isActive) return child.isActive(pathname);
  if (child.end) return pathname === child.to;
  return pathname === child.to || pathname.startsWith(`${child.to}/`);
}
