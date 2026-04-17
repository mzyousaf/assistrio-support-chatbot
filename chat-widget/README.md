# @assistrio/chat-widget

Embeddable chat UI (CDN **`assistrio-chat.js`** / **`assistrio-chat.css`**) and npm ESM entry for React apps.

## Environment

The package itself does not use a `.env` file. The **host page** passes runtime config (e.g. **`apiBaseUrl`**, **`botId`**, keys) as described in the admin app snippet rules and backend widget APIs.

For **local full-stack** setup (API + apps + CORS), see the monorepo **[`docs/ARCHITECTURE_AND_LOCAL_DEV.md`](../docs/ARCHITECTURE_AND_LOCAL_DEV.md)**.

## Building

Use the scripts in this package’s `package.json` (or the admin app’s `build:embed` pipeline that consumes this workspace).
