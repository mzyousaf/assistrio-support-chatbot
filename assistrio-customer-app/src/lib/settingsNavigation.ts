/** Workspace Settings sidebar order (labels only). */
export const SETTINGS_NAV_ITEMS = [
  { to: '/settings/workspace', label: 'General' },
  { to: '/settings/members', label: 'Members' },
  { to: '/settings/plans', label: 'Plans' },
  { to: '/settings/billing', label: 'Billing' },
] as const;

export type SettingsNavRoute = (typeof SETTINGS_NAV_ITEMS)[number]['to'];

/** Legacy account routes map to Workspace settings. */
export function normalizeSettingsPathname(pathname: string): string {
  if (
    pathname.startsWith('/settings/account') ||
    pathname.startsWith('/settings/general')
  ) {
    return '/settings/workspace';
  }
  return pathname;
}

export function resolveSettingsNavActiveIndex(pathname: string): number {
  const normalized = normalizeSettingsPathname(pathname);
  return SETTINGS_NAV_ITEMS.findIndex((item) => normalized.startsWith(item.to));
}
