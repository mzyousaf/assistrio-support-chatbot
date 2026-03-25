import Script from "next/script";
import { getLandingAssistrioChatConfig } from "@/lib/assistrio-widget-defaults";

const WIDGET_JS = "https://widget.assistrio.com/assistrio-chat.js";

/**
 * Direct embed: same as the static snippet (inline config + script).
 * Stylesheet is in root layout `<head>`. Uses `next/script` so config runs
 * before the widget bundle loads.
 */
export function AssistrioGlobalEmbed() {
  const cfg = getLandingAssistrioChatConfig();
  const inline = `window.AssistrioChatConfig = ${JSON.stringify(cfg)};`;

  return (
    <>
      <Script id="assistrio-global-config" strategy="afterInteractive">
        {inline}
      </Script>
      <Script src={WIDGET_JS} strategy="afterInteractive" />
    </>
  );
}
