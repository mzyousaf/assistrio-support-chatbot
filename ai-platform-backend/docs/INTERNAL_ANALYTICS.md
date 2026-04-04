# Internal analytics (admin / operator) — product model & API plan

> **Map:** [ANALYTICS_BOUNDARIES.md](./ANALYTICS_BOUNDARIES.md) — ingestion vs internal vs PV-safe (read this first for layer rules).

This document describes **Assistrio-internal** analytics: authenticated reporting for your dashboard, **not** anonymous platform-visitor (PV) surfaces.

**Separation (non-negotiable):**

| Layer | Purpose | Examples |
|-------|---------|----------|
| **Raw ingestion** | Append-only events from browsers or server | `POST /api/analytics/track`, `VisitorsService.createVisitorEvent` |
| **Internal reporting** | Aggregates, funnels, admin UI | `GET /api/user/analytics` (today), future `/api/user/analytics/*` |
| **PV-safe summaries** | Product-shaped, scoped by `platformVisitorId` | `POST /api/public/visitor-quota/summary`, `POST /api/public/visitor-bot/*` |

PV clients must **never** consume internal event streams or `/api/user/analytics` contracts. See `PV_SAFE_PUBLIC_APIS.md`.

---

## 1. Code-grounded audit — data available today

### 1.1 `VisitorEvent` (`visitor-event.schema.ts`)

**Fields:** `visitorId` (stores **platformVisitorId** for marketing/analytics rows), `type`, optional `path`, `botSlug`, `botId`, `metadata`, `createdAt`.

**Indexes:** `visitorId`, `type`, `botSlug`, `(visitorId, createdAt)`, `(type, createdAt)` — support time-range + type filters.

**Emitted in code (verified):**

| Event type | Where |
|------------|--------|
| `trial_bot_created` | `trial-bots.controller.ts` → `VisitorsService.createVisitorEvent` after successful trial bot creation (includes `botId`, `botSlug`). |
| All types accepted by DTO | `POST /api/analytics/track` → `AnalyticsService.trackEvent` (landing/marketing when clients send them). |

**In schema + `getSummary()` counts but not found emitted in app code:**

| Event type | Note |
|------------|------|
| `demo_chat_started` | **No producer** in `ai-platform-backend/src` — counts stay at 0 unless something external writes them. |
| `trial_chat_started` | **No producer** in `ai-platform-backend/src` — same. |

**`getSummary()`** (`analytics.service.ts`) counts: platform visitors, chat visitors, `page_view`, `trial_bot_created`, `demo_chat_started`, `trial_chat_started`, showcase vs visitor-own bot counts; plus **last 20** events (selected fields only).

**Gap:** Extended landing types (`cta_clicked`, `demo_opened`, …) are in the enum; volume depends on landing actually calling `/api/analytics/track`. Not all deployments send them.

### 1.2 `Visitor` (`visitor.schema.ts`)

**Platform rows (`visitorType: 'platform'`):** `visitorId` = `platformVisitorId`, counters `showcaseMessageCount`, `ownBotMessageCount`, `previewUserMessageCount`, `trialPreviewUserMessageCount` (deprecated), `lastSeenAt`, optional profile `name`/`email`/`phone`, `platformEmbedAllowedUrl`.

**Chat rows (`visitorType: 'chat'`):** `visitorId` = `chatVisitorId` — **separate** identity for widget session aggregates in `visitors` collection.

**Reliable for internal analytics:** counts on platform visitor docs; **not** a full event log.

### 1.3 `Bot` (`bot.schema.ts`)

**Dimensions:** `type` (`showcase` | `visitor-own`), `creatorType`, `ownerVisitorId`, `ownerUserId`, `status`, `allowedDomains`, `leadCapture`, `createdAt`, message limit fields, etc.

**Internal use:** top bots, trial vs showcase inventory, bot-level policy — **no** per-message history on the bot document itself.

### 1.4 `Conversation` + `Message`

**Conversation:** `botId`, `chatVisitorId`, optional legacy `visitorId` (platform visitor on embed-created threads per `chat-engine.service`), `capturedLeadData`, `leadCaptureMeta`, `lastActivityAt`, `createdAt`.

**Message:** `botId`, `conversationId`, `chatVisitorId`, optional `visitorId` (platform), `role`, `trialRuntimeUserMessage`, `showcaseRuntimeUserMessage`, `createdAt`.

**Reliable internal signals:**

- **Runtime vs preview:** `trialRuntimeUserMessage` / `showcaseRuntimeUserMessage` on user messages (see `visitors.service.ts` quota helpers).
- **Lead capture:** presence/shape of `capturedLeadData` on conversations (PII — **internal** reporting only; aggregate or redact for exports).
- **Volume:** message counts, conversation counts, time-bucketed aggregations by `createdAt`.

**Weak / caveats:**

- Older data may omit `visitorId` on some conversations/messages — mixed migration story in comments.
- Chat identity (`chatVisitorId`) does not map 1:1 to `platformVisitorId` without joining messages/conversations.

### 1.5 Quota / limits (logic in `VisitorsService`)

Preview cap, trial runtime cap, showcase runtime cap — **derived from** visitor doc counters + message flags, not from `VisitorEvent` alone.

### 1.6 Existing HTTP surfaces

| Endpoint | Role |
|-----------|------|
| `POST /api/analytics/track` | Ingestion (anonymous), validated DTO — **internal pipeline input**, not PV dashboard. |
| `GET /api/user/analytics` | **AuthGuard** — current single “dashboard” payload (`metrics` + `recentEvents`). |
| `POST /api/public/visitor-quota/summary` etc. | **PV-safe only** — do not use as internal admin API. |

### 1.7 `VisitorsService.getOneWithDetails`

Returns visitor + **up to 50** recent events + owned bots list + `conversationsCount` — **admin-style** detail, suitable for **internal** drill-down, not for PV.

---

## 2. Internal analytics product model (by area)

Below: **supported** = queryable from current collections with clear semantics; **partial** = needs filters or has data holes; **not supported** = no honest metric without new instrumentation.

### Overview

| Metric / card | Supported? | Source |
|---------------|------------|--------|
| Total platform visitors | Yes | `Visitor` count `visitorType: platform` |
| Total chat identities | Yes | `Visitor` count `visitorType: chat` |
| Showcase / visitor-own bot counts | Yes | `Bot` by `type` |
| Event totals by type (all time) | Yes | `VisitorEvent` counts (note dead types) |
| Event totals in date range | Yes | `VisitorEvent` with `createdAt` filter (index-friendly) |

### Acquisition / landing funnel

| Metric | Supported? | Notes |
|--------|------------|--------|
| Page views over time | **Partial** | `VisitorEvent` `page_view` + `path`/`metadata` **if** landing sends track events |
| CTA / demo / trial step funnel | **Partial** | Same — depends on `/api/analytics/track` volume |
| Unique “platform visitors” landing | **Weak** | Distinct `visitorId` on events — possible but not same as “users” |

### Showcase usage

| Metric | Supported? | Notes |
|--------|------------|--------|
| Showcase bot count | Yes | `Bot` |
| Showcase runtime message volume | Yes | `Message` `showcaseRuntimeUserMessage: true` + time range |
| Per-showcase-bot messages | Yes | `Message` by `botId` + flag |
| `demo_chat_started` funnel | **Not supported** until something **emits** it |

### Trial funnel

| Metric | Supported? | Notes |
|--------|------------|--------|
| Trial bots created | Yes | `VisitorEvent` `trial_bot_created` and/or `Bot` `type: visitor-own` + time |
| Trial runtime messages | Yes | `Message` `trialRuntimeUserMessage` |
| `trial_chat_started` | **Not supported** until emitted |

### Bot performance

| Metric | Supported? | Notes |
|--------|------------|--------|
| Messages per bot | Yes | `Message` aggregation |
| Conversations per bot | Yes | `Conversation` count by `botId` |
| Visitor-own vs showcase | Yes | join `Bot.type` |

### Runtime usage

| Metric | Supported? | Notes |
|--------|------------|--------|
| Trial vs showcase runtime volume | Yes | message flags + `createdAt` |
| Preview volume | **Partial** | visitor counters + message-level preview is via visitor doc counts (`checkPlatformVisitorPreviewMessageQuota` path) — not one row per “preview message” in all paths |

### Lead capture

| Metric | Supported? | Notes |
|--------|------------|--------|
| Conversations with leads | Yes | `Conversation` where `capturedLeadData` has keys |
| Count by bot | Yes | filter by `botId` |
| **Values** in dashboard | Technically yes | **Treat as PII** — policy for internal UI only |

### Visitor activity

| Metric | Supported? | Notes |
|--------|------------|--------|
| Recent events stream | Yes | `VisitorEvent` (internal) |
| Per-platform-visitor drill-down | Yes | `getOneWithDetails` pattern |
| Chat-only visitor journeys | **Partial** | `chatVisitorId` threads — different grain |

### Content / demo performance

| Metric | Supported? | Notes |
|--------|------------|--------|
| By `botSlug` / landing path | **Partial** | `VisitorEvent.botSlug`, `path` when populated |
| Knowledge/doc engagement | **Not supported** | No doc-level analytics model in scope |

---

## 3. Internal analytics API structure (`/api/user/analytics/*`)

All routes: **`AuthGuard`**, JSON, **no** anonymous access.

**Principles:**

- **Product-shaped** responses: aggregates + paginated tables — not unbounded raw dumps by default.
- **Query params:** `from`, `to` (ISO date) on overview/time-series where useful; validate max range server-side (see `analytics-date-range.util.ts`).
- **Versioning:** `schemaVersion` in payloads when evolving.

**Implemented:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user/analytics/overview` | Time-bounded dashboard summary (`?from=&to=` optional; default last 30 days). See `AnalyticsService.getAnalyticsOverview`. |
| GET | `/api/user/analytics/bots/summary` | Per-bot operational metrics for a date range (table-oriented). `AnalyticsService.getBotsSummary`. |
| GET | `/api/user/analytics/leads/summary` | Lead capture aggregates (counts only; `byBot` breakdown capped). `AnalyticsService.getLeadsSummary`. |
| GET | `/api/user/analytics/bots/:id` | Single-bot internal analytics — no `secretKey`. `AnalyticsService.getBotAnalyticsDetail`. |
| GET | `/api/user/analytics` | Legacy lifetime snapshot + 20 recent events (`getSummary`). |

**Planned (incremental):**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user/analytics/events` | Paginated, filterable `VisitorEvent` (type, date, optional `botSlug`) — **internal** only |
| GET | `/api/user/analytics/funnel` | Aggregates by event type + optional path (landing funnel) |
| GET | `/api/user/analytics/timeseries/messages` | Bucketed counts by `trialRuntime` / `showcaseRuntime` / role |

**Deprecate gradually:** fold current `GET /api/user/analytics` into `overview` + small `recentEvents` or redirect with same auth.

**Explicitly not PV:** document that these paths are under `/api/user/` and guarded — never expose to `POST /api/public/*`.

---

## 4. Slice 1 — **implemented** (`GET /api/user/analytics/overview`)

- **Query:** `from`, `to` (ISO 8601). Omitted → last **30 days** ending now; max span **366 days** (`analytics-date-range.util.ts`).
- **Response:** `schemaVersion`, `range`, `overview` (VisitorEvent aggregates by type), `messages` (counts incl. runtime flags), `bots` (visitor-own created in range + published showcase snapshot), `leads` (conversations with captured lead fields in range), `caveats` (honest limitations).
- **Next slices:** paginated `events`, `funnel`, time-series buckets; optional bot-detail UI wiring for `GET /bots/:id`.

---

## 5. Known data gaps & caveats

1. **`demo_chat_started` / `trial_chat_started`:** enumerated and counted in legacy `getSummary()` but **not produced** in codebase — fix by emitting from chat/widget when product wants those funnel steps, or remove from dashboard KPIs.
2. **Landing funnel:** depends on **clients** calling `/api/analytics/track` consistently.
3. **Distinct “users”:** `platformVisitorId` is anonymous; internal “unique visitors” is an approximation (distinct event `visitorId` or distinct visitor docs).
4. **Lead PII:** internal APIs must still respect minimization/redaction for exports and logs.
5. **`metadata` on events:** unstructured — fine for exploration; for stable dashboards, prefer typed fields or documented `metadata` keys.

---

## 6. Related files (maintenance)

| File | Role |
|------|------|
| `docs/ANALYTICS_BOUNDARIES.md` | One-page map: ingestion vs internal vs PV-safe |
| `src/models/visitor-event.schema.ts` | Event taxonomy |
| `src/analytics/analytics.service.ts` | `getSummary`, `getAnalyticsOverview`, `trackEvent` |
| `src/analytics/analytics-date-range.util.ts` | Internal overview date parsing |
| `src/analytics/analytics.controller.ts` | `GET /overview`, `GET /bots/summary`, `GET /leads/summary`, `GET /bots/:id`, `GET /` |
| `src/analytics/analytics-track.controller.ts` | Ingestion |
| `src/visitors/visitors.service.ts` | Quota, `createVisitorEvent`, `getOneWithDetails` |
| `src/bots/trial-bots.controller.ts` | Emits `trial_bot_created` |
| `docs/PV_SAFE_PUBLIC_APIS.md` | PV vs internal boundary |
