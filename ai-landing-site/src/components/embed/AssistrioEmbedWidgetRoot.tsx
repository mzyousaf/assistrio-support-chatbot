"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { EmbedWidgetRootProps } from "@assistrio/chat-widget";

/**
 * Client-only embed: `@assistrio/chat-widget` is browser-oriented; a static import runs on the
 * server and can throw (`document is not defined`). Always use this wrapper in Next.js App Router.
 */
export const AssistrioEmbedWidgetRoot: ComponentType<EmbedWidgetRootProps> = dynamic(
  () => import("@assistrio/chat-widget").then((m) => m.EmbedWidgetRoot),
  { ssr: false },
);
