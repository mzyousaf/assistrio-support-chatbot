/** Match backend rules for saved embed origins (loopback rejected for saved rows). */
export function normalizeCustomerEmbedOrigin(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' || h === '::1') {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

/** Hosted customer app origin (share + iframe URLs). Prefer `VITE_PUBLIC_APP_ORIGIN` in production. */
export function getCustomerAppPublicOrigin(): string {
  const env = (import.meta.env.VITE_PUBLIC_APP_ORIGIN ?? '').replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined') return window.location.origin;
  if (import.meta.env.DEV) return 'http://localhost:3002';
  return '';
}

/**
 * Full chat panel iframe — parent page must be in the bot’s allowed origins.
 * Private bots: `secretKey` is included in the query string (treat like a password; prefer public bots for iframe if possible).
 *
 * Optional query `parentPageUrl` (host page URL) is recommended for Chats → Top Pages analytics;
 * append when rendering the iframe, e.g. `&parentPageUrl=${encodeURIComponent(window.location.href)}`.
 */
export function iframeEmbedSnippet(params: {
  appOrigin: string;
  botId: string;
  accessKey: string;
  secretKey?: string;
}): string {
  const base = params.appOrigin.replace(/\/$/, '');
  const q = new URLSearchParams();
  q.set('accessKey', params.accessKey);
  if (params.secretKey?.trim()) q.set('secretKey', params.secretKey.trim());
  return [
    `<!-- Optional but recommended: append &parentPageUrl= plus encodeURIComponent(host-page-url) for Top Pages analytics. -->`,
    `<iframe`,
    `  src="${base}/iframe/${encodeURIComponent(params.botId)}?${q.toString()}"`,
    `  style="width:100%;height:650px;border:0;border-radius:16px;"`,
    `  allow="clipboard-write; microphone"`,
    `  title="Assistrio chat"`,
    `></iframe>`,
  ].join('\n');
}

export function widgetSnippet(params: {
  botId: string;
  apiBaseUrl: string;
  accessKey: string;
  secretKey?: string;
  visibility: 'public' | 'private';
  widgetAssetOrigin?: string;
}): string {
  const asset =
    (params.widgetAssetOrigin ?? 'https://widget.assistrio.com').replace(/\/$/, '') ||
    'https://widget.assistrio.com';
  const configLines = [
    `botId: "${params.botId}"`,
    `apiBaseUrl: "${params.apiBaseUrl}"`,
    ...(params.accessKey ? [`accessKey: "${params.accessKey}"`] : []),
    ...(params.visibility === 'private' && params.secretKey
      ? [`secretKey: "${params.secretKey}"`]
      : []),
    `position: "right"`,
  ];
  return [
    `<link rel="stylesheet" href="${asset}/assistrio-chat.css" />`,
    `<script>`,
    `  window.AssistrioChatConfig = {`,
    `    ${configLines.join(',\n    ')}`,
    `  };`,
    `</script>`,
    `<script src="${asset}/assistrio-chat.js" async></script>`,
  ].join('\n');
}
