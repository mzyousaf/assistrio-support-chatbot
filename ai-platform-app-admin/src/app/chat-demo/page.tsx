"use client";

import { useEffect } from "react";
import {
  mountAssistrioWidgetFromCdn,
  unmountAssistrioCdnWidget,
} from "@/lib/assistrio-cdn-widget";

const DEMO_IDS = {
  linkId: "assistrio-chat-css-chat-demo",
  scriptId: "assistrio-chat-js-chat-demo",
} as const;

/**
 * Loads the production Assistrio widget from CDN (same snippet as customers).
 * Set `NEXT_PUBLIC_CHAT_DEMO_BOT_ID` to a bot id that accepts widget access from this origin.
 */
export default function ChatDemoPage() {
  useEffect(() => {
    const botId = process.env.NEXT_PUBLIC_CHAT_DEMO_BOT_ID?.trim();
    const apiBaseUrl =
      (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim() ||
      (typeof window !== "undefined" ? window.location.origin : "");

    if (!botId || typeof window === "undefined") return;

    mountAssistrioWidgetFromCdn(
      {
        botId,
        apiBaseUrl,
        position: "right",
      },
      { ids: DEMO_IDS, injectStylesheet: false }
    );

    return () => {
      unmountAssistrioCdnWidget();
    };
  }, []);

  const hasBot = Boolean(process.env.NEXT_PUBLIC_CHAT_DEMO_BOT_ID?.trim());

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Chat widget demo (CDN)
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Uses the hosted <code className="text-sm">assistrio-chat.js</code> from{" "}
            <code className="text-sm">widget.assistrio.com</code>, same as production embeds.
          </p>
        </header>

        {!hasBot ? (
          <p className="text-amber-800 dark:text-amber-200 text-sm rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
            Set <code className="text-xs">NEXT_PUBLIC_CHAT_DEMO_BOT_ID</code> in{" "}
            <code className="text-xs">.env.local</code> to mount the widget on this page.
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use the chat bubble in the bottom-right corner. The widget is loaded from the CDN bundle
            built from the <code className="text-xs">chat-widget</code> package.
          </p>
        )}
      </div>
    </main>
  );
}
