/**
 * CDN URLs for the IIFE bundle (`AssistrioChat` global).
 * Override with env when self-hosting the widget build next to the API.
 */
export function getAssistrioWidgetCdnUrls(): { js: string; css: string } {
  const jsDirect = process.env.NEXT_PUBLIC_ASSISTRIO_WIDGET_JS_URL?.trim();
  const cssDirect = process.env.NEXT_PUBLIC_ASSISTRIO_WIDGET_CSS_URL?.trim();
  if (jsDirect && cssDirect) {
    return { js: jsDirect, css: cssDirect };
  }
  const rawBase = process.env.NEXT_PUBLIC_ASSISTRIO_WIDGET_CDN_BASE_URL?.trim();
  const base = rawBase ? rawBase.replace(/\/$/, "") : "";
  if (base) {
    return {
      js: `${base}/assistrio-chat.js`,
      css: `${base}/assistrio-chat.css`,
    };
  }
  return {
    js: "https://widget.assistrio.com/assistrio-chat.js",
    css: "https://widget.assistrio.com/assistrio-chat.css",
  };
}
