/**
 * Allowed quick-link icon ids (curated Lucide names, kebab-case).
 * Keep in sync with `chat-widget/src/lib/quickLinkIcons.ts` → `QUICK_LINK_ICON_IDS`.
 */
export const QUICK_LINK_ICON_IDS = [
  'external-link',
  'home',
  'mail',
  'phone',
  'message-circle',
  'help-circle',
  'file-text',
  'link-2',
  'calendar',
  'shopping-cart',
  'credit-card',
  'user',
  'users',
  'building-2',
  'map-pin',
  'globe',
  'package',
  'truck',
  'book-open',
  'life-buoy',
  'wrench',
  'search',
  'settings',
  'shield',
  'bell',
  'bookmark',
  'briefcase',
  'camera',
  'clipboard-list',
  'clock',
  'download',
  'headphones',
  'heart',
  'image',
  'info',
  'lightbulb',
  'lock',
  'megaphone',
  'newspaper',
  'play-circle',
  'send',
  'share-2',
  'smartphone',
  'star',
  'store',
  'ticket',
  'video',
  'zap',
] as const;

const ALLOWED = new Set<string>(QUICK_LINK_ICON_IDS);

export function normalizeQuickLinkIcon(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  return ALLOWED.has(s) ? s : undefined;
}
