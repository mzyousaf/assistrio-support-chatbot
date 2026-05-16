import { readBrowserPageContext } from './browserPageConversationContext';

/**
 * Optional attribution for script-embed runtime (`POST /api/chat/message`).
 * Server sanitizes/truncates; do not include secrets or raw UA.
 */
export function buildRuntimeWidgetConversationOrigin(): {
  source: 'script_embed';
  mode: 'runtime';
  embedType: 'widget';
  pageUrl: string;
  referrer: string;
  websiteOrigin: string;
} | undefined {
  const browser = readBrowserPageContext();
  if (!browser) return undefined;
  return {
    source: 'script_embed',
    mode: 'runtime',
    embedType: 'widget',
    pageUrl: browser.pageUrl,
    referrer: browser.referrer,
    websiteOrigin: browser.websiteOrigin,
  };
}
