/**
 * HTML snippet for **trial runtime** embed (CDN bundle + `window.AssistrioChatConfig`).
 * Matches the contract used by `mountAssistrioRuntimeFromCdn` / `assistrio-cdn-widget`: runtime mode, no preview/session flags.
 *
 * Product context: `docs/PRODUCT_MODEL.md`.
 *
 * - `embedOrigin` is omitted — the widget defaults to `window.location.origin` on the host page (must match allowed website).
 * - `chatVisitorId` is omitted — created by the widget.
 */
export function buildTrialRuntimeEmbedSnippet(params: {
  cssUrl: string;
  jsUrl: string;
  apiBaseUrl: string;
  botId: string;
  accessKey: string;
  platformVisitorId: string;
}): string {
  const apiBaseUrl = params.apiBaseUrl.replace(/\/+$/, "");
  const config = {
    mode: "runtime" as const,
    botId: params.botId,
    apiBaseUrl,
    accessKey: params.accessKey,
    platformVisitorId: params.platformVisitorId,
    position: "right" as const,
  };
  const json = JSON.stringify(config, null, 2);
  return `<link rel="stylesheet" href="${params.cssUrl}" />
<script>
window.AssistrioChatConfig = ${json};
</script>
<script src="${params.jsUrl}" async></script>`;
}
