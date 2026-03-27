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

- Run **`npm run build`** from `packages/chat-widget` and ship the **new** `dist/` pair together (JS + CSS from the same build).
- Smoke-test with **`npm run test:local`** and the sample page under `examples/local-test/`.
- Confirm your **API** CORS and cookie behavior match how customers embed (see codebase review: credentials on chat requests).
