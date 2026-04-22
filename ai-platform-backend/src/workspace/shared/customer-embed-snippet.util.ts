/**
 * Mirrors `assistrio-customer-app/src/lib/embedOrigin.ts` `widgetSnippet` for server-side responses.
 */
export function buildCustomerEmbedSnippet(params: {
  botId: string;
  apiBaseUrl: string;
  accessKey: string;
  secretKey?: string;
  visibility: 'public' | 'private';
  widgetAssetOrigin: string;
}): string {
  const asset =
    params.widgetAssetOrigin.replace(/\/$/, '') || 'https://widget.assistrio.com';
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
