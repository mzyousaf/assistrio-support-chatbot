# @assistrio/chat-widget

Standalone build of the Assistrio chat embed: **assistrio-chat.js** and **assistrio-chat.css**.

- Source lives under `src/` (embed runtime, `AdminLiveChatAdapter`, `chat-ui`, hooks, models).
- The main Next.js app is unchanged; it still uses its own `src/embed` until you wire this package in.

## Build

From this directory:

```bash
npm install
npm run build
```

Outputs:

- `dist/assistrio-chat.js` — IIFE, exposes `window.AssistrioChat`
- `dist/assistrio-chat.css` — Tailwind + widget-scoped utilities
- `dist/index.mjs` — ESM library (`EmbedWidgetRoot`, `mountEmbedWidget`, config helpers) for bundlers

## npm / React (Next.js App Router)

The ESM bundle targets the browser. **Do not** statically import `EmbedWidgetRoot` from a Server Component or from a file that Next will evaluate on the server — that can throw (`document is not defined`).

Use `next/dynamic` with `ssr: false`, or a small client wrapper:

```tsx
"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { EmbedWidgetRootProps } from "@assistrio/chat-widget";

export const AssistrioEmbedWidgetRoot: ComponentType<EmbedWidgetRootProps> = dynamic(
  () => import("@assistrio/chat-widget").then((m) => m.EmbedWidgetRoot),
  { ssr: false },
);
```

Then render `<AssistrioEmbedWidgetRoot rawConfig={{ ... }} />` from client components.

## Host snippet

```html
<link rel="stylesheet" href="https://YOUR_CDN/assistrio-chat.css" />
<script>
  window.AssistrioChatConfig = {
    botId: "...",
    apiBaseUrl: "https://YOUR_API",
    accessKey: "...",
    // secretKey: "...", // required only for private bots
    // visitorId: "...", // required for visitor-owned trial chat flows
    position: "right"
  };
</script>
<script src="https://YOUR_CDN/assistrio-chat.js" async></script>
```

## Runtime Access Contract

External runtime credential rules:

- public bot: `accessKey` required
- private bot: `accessKey` + `secretKey` required
- visitor-owned trial bot: runtime chat requires `visitorId`

## Widget Modes

`EmbedChatConfig.mode`:

- `runtime` - always loads runtime init from backend
- `preview` - can still load runtime init unless `disableRemoteConfig === true`

`previewOverrides`:

- merged client-side over normalized settings
- intended for editor/live-preview UX (name/avatar/chat UI/suggested questions)
- does not persist bot data

## Snippet Rules

When generating runtime snippets for host pages:

- always include `botId` + `apiBaseUrl`
- include `accessKey` for all runtime bots
- include `secretKey` only for private bots
- include `visitorId` only for visitor-owned trial flows

## Runtime Error Codes

Widget init/chat error payloads can include stable `errorCode` values:

- `BOT_NOT_PUBLISHED`
- `INVALID_ACCESS_KEY`
- `INVALID_SECRET_KEY`
- `VISITOR_ID_REQUIRED`
- `MESSAGE_LIMIT_REACHED`

The package surfaces backend message + code in init errors and maps known chat error codes to safe fallback text.

## Scripts

| Script       | Description                    |
|-------------|--------------------------------|
| `npm run build` | JS + CSS                      |
| `npm run build:js` | `assistrio-chat.js` only   |
| `npm run build:css` | `assistrio-chat.css` only  |
| `npm run typecheck` | TypeScript check           |
