# AI Landing Site

Next.js marketing/landing site that renders public bots and trial bot flows with the hosted widget.

## Environment

Copy `.env.example` to `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL` - backend API origin used for landing data and widget runtime
- `LANDING_SITE_BOTS_API_KEY` - server-side key used when calling `GET /api/public/landing/bots`
- `NEXT_PUBLIC_LANDING_WIDGET_BOT_ID` - default global widget bot id
- `NEXT_PUBLIC_LANDING_WIDGET_ACCESS_KEY` - access key for the default global widget bot

Global/default widget mounting is intentionally skipped when `NEXT_PUBLIC_LANDING_WIDGET_ACCESS_KEY` is missing.

## Runtime Access Contract (Landing Usage)

- Listed/public demo bots: widget receives `botId` + `accessKey`
- Private bots are not used by anonymous landing list flows
- Trial visitor-owned chat flow uses `visitorId` in runtime chat calls

## Visitor Trial Flow

High-level sequence:

1. Landing creates a trial bot via `POST /api/trial/bots`
2. Response includes runtime-safe context (`botId`, `visitorId`, `accessKey`, visibility/creator metadata)
3. Landing stores this context locally and reuses it for widget runtime
4. Chat uses trial policy (`fixed_total`) and returns limit state when exhausted

Limit behavior:

- trial bot message cap is enforced server-side
- when exhausted, chat response includes `limitReached: true` and `errorCode: MESSAGE_LIMIT_REACHED`

## Runtime Error Codes

Landing/widget flows may receive runtime-safe `errorCode` values:

- `BOT_NOT_PUBLISHED`
- `INVALID_ACCESS_KEY`
- `INVALID_SECRET_KEY`
- `VISITOR_ID_REQUIRED`
- `MESSAGE_LIMIT_REACHED`
