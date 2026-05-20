import { PRIMARY_NAV, isPrimaryNavChildActive } from './primaryNav';

/** Topbar section label from the current admin route (active primary subnav when applicable). */
export function getAdminSectionLabel(pathname: string): string | null {
  for (const entry of PRIMARY_NAV) {
    if (entry.kind !== 'group') continue;
    const activeChild = entry.children.find((child) => isPrimaryNavChildActive(child, pathname));
    if (activeChild) return activeChild.label;
  }

  if (pathname.startsWith('/admin-bots')) return 'Admin bots';
  if (pathname.startsWith('/customers')) return 'Customers';
  if (pathname === '/bots' || pathname.startsWith('/bots/')) return 'Bots';
  return null;
}
