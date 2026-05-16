import { readBrowserPageContext } from './browserPageConversationContext';

/**
 * Playground / workspace widget preview attribution (`POST /api/widget/preview/chat`).
 */
export function buildPlaygroundPreviewConversationOrigin(sourcePage?: string): {
  source: 'playground_preview';
  mode: 'preview';
  embedType: 'playground';
  pageUrl: string;
  referrer: string;
  websiteOrigin: string;
  surface?: string;
} | undefined {
  const browser = readBrowserPageContext();
  if (!browser) return undefined;
  const sp = (sourcePage ?? (typeof window !== 'undefined' ? window.location.pathname : '')).trim();
  return {
    source: 'playground_preview',
    mode: 'preview',
    embedType: 'playground',
    pageUrl: browser.pageUrl,
    referrer: browser.referrer,
    websiteOrigin: browser.websiteOrigin,
    ...(sp ? { surface: sp.slice(0, 512) } : {}),
  };
}
