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
