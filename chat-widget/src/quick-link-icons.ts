/**
 * Server-safe entry: only icon ids + Lucide resolvers (no embed UI / markdown).
 * Import from `@assistrio/chat-widget/quick-link-icons` in Next.js to avoid loading `dist/index.mjs` on SSR.
 */
export { QUICK_LINK_ICON_IDS, getQuickLinkIcon, isQuickLinkIconId } from "./lib/quickLinkIcons";
export type { QuickLinkIconId } from "./lib/quickLinkIcons";
