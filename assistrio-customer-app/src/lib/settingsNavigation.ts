/** Workspace Settings sidebar order (labels only; icons live in AppShell). */
export const SETTINGS_NAV_ITEMS = [
  { to: '/settings/account', label: 'User Account' },
  { to: '/settings/workspace', label: 'Workspace' },
  { to: '/settings/members', label: 'Members' },
  { to: '/settings/plans', label: 'Plans' },
  { to: '/settings/billing', label: 'Billing' },
] as const;

/** Legacy `/settings/general` maps to User Account. */
export function normalizeSettingsPathname(pathname: string): string {
  if (pathname.startsWith('/settings/general')) return '/settings/account';
  return pathname;
}

export function resolveSettingsNavActiveIndex(pathname: string): number {
  const normalized = normalizeSettingsPathname(pathname);
  return SETTINGS_NAV_ITEMS.findIndex((item) => normalized.startsWith(item.to));
}
