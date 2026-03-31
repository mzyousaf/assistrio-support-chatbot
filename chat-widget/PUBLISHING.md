# Publishing the standalone embed (`dist/`)

## Hosting JS and CSS

- Host **`assistrio-chat.js`** and **`assistrio-chat.css`** as static files on HTTPS (CDN or object storage + CDN).
- Set long cache headers for versioned filenames (see below). For unversioned names, use shorter cache or a cache-bust query string only if you accept operational risk.
- Serve with correct **`Content-Type`**: `application/javascript` (or `text/javascript`) for `.js`, `text/css` for `.css`.
- **Subresource Integrity (optional but strong):** after each release, publish `integrity` hashes for both files and document them for customers who want SRI.

## Versioned filenames

- **Recommended:** emit copies like `assistrio-chat.v0.1.0.js` / `assistrio-chat.v0.1.0.css` (or a content hash) so customers can pin a URL and you can cache “forever” safely.
- Keep **one** unversioned alias (`assistrio-chat.js`) only if you want always-latest behavior and accept that a bad deploy affects everyone immediately.

## Release safety (small checklist)

- Run **`npm run build`** from the `chat-widget` package root and ship the **new** `dist/` assets together (JS + CSS + `index.mjs` + `.d.ts` from the same build).
- Smoke-test with **`npm run test:local`** if you use a local static server.
- Confirm your **API** CORS and cookie behavior match how customers embed (credentials on chat requests).

## npm (`@assistrio/chat-widget`)

- **Build:** `npm run build` produces `dist/index.mjs` (ESM library), `dist/index.d.ts` (and sibling `.d.ts` files), plus the CDN `assistrio-chat.js` / `assistrio-chat.css`.
- **Peer deps:** consumers must install **`react`** and **`react-dom`** (see `peerDependencies` in `package.json`).
- **Import:** `import { EmbedWidgetRoot, mountEmbedWidget } from "@assistrio/chat-widget"`.
- **CDN paths in package:** `import "@assistrio/chat-widget/assistrio-chat.css"` or use the subpath `assistrio-chat.js` from `exports` if you host via npm `exports` (usually you still host the IIFE on your CDN).
- **Publish:** log in to npm, ensure the **`@assistrio`** scope exists on your org (or change the package `name`). First publish of a scoped public package:  
  `npm publish --access public`
- **`prepublishOnly`** runs `npm run build` automatically before publish.
