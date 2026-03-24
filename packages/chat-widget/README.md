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

## Host snippet

```html
<link rel="stylesheet" href="https://YOUR_CDN/assistrio-chat.css" />
<script>
  window.AssistrioChatConfig = {
    botId: "...",
    apiBaseUrl: "https://YOUR_API",
    accessKey: "optional",
    position: "right"
  };
</script>
<script src="https://YOUR_CDN/assistrio-chat.js" async></script>
```

## Scripts

| Script       | Description                    |
|-------------|--------------------------------|
| `npm run build` | JS + CSS                      |
| `npm run build:js` | `assistrio-chat.js` only   |
| `npm run build:css` | `assistrio-chat.css` only  |
| `npm run typecheck` | TypeScript check           |
