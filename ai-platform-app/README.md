# AI Platform App

Next.js dashboard/admin app for creating, configuring, and previewing bots.

## Environment

Copy `.env.example` to `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL` - backend API origin used by dashboard calls and embed preview/runtime calls

## Widget Modes (Dashboard Preview)

The app-side embed integration supports two modes:

- `runtime` - uses external runtime endpoints (`/api/widget/init`, `/api/chat/message`) with runtime credentials
- `preview` - dashboard live preview mode; can render with local overrides while editing

`previewOverrides` behavior:

- applied client-side over normalized widget settings
- used for live editing preview (name/avatar/chat UI/suggested questions, etc.)
- does not change persisted bot data by itself

## Snippet Generation Rules

Production snippet in bot settings follows runtime contract:

- always includes `botId` + `apiBaseUrl`
- includes `accessKey` when available
- includes `secretKey` only when visibility is `private`
- includes `visitorId` only for visitor-owned bots with an owner visitor id

## Runtime Error Codes (Frontend Handling)

Embed init/chat frontend handling is code-aware and maps runtime-safe errors when `errorCode` is present.

Common runtime codes:

- `BOT_NOT_PUBLISHED`
- `INVALID_ACCESS_KEY`
- `INVALID_SECRET_KEY`
- `VISITOR_ID_REQUIRED`
- `MESSAGE_LIMIT_REACHED`
