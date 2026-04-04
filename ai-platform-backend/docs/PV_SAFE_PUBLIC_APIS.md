# PV-safe public APIs vs internal analytics

> **Map:** [ANALYTICS_BOUNDARIES.md](./ANALYTICS_BOUNDARIES.md) — which HTTP surfaces PV UIs may call vs internal-only.

This document locks the **contract split** between:

1. **Internal analytics** — ingestion and reporting for Assistrio operators; **not** a product surface for anonymous platform visitors.
2. **PV-safe (platform visitor) public APIs** — stable, summary-only responses scoped by `platformVisitorId` (and bot ownership where applicable).

## Rules

| Rule | Detail |
|------|--------|
| **Identity** | `platformVisitorId` is the anonymous ownership / quota / continuity key for PV-facing routes. |
| **Not used for PV analytics views** | `chatVisitorId` — chat thread identity only; do not build PV “insight” screens on chat ids alone. |
| **No raw internal events to PV** | `POST /api/analytics/track` and `VisitorEvent` streams are **internal**. PV product UIs must call **PV-safe summary** routes only. |
| **No admin contracts on PV** | `GET /api/user/analytics` (authenticated) is internal; never reuse its shape for anonymous callers. |
| **Summary-only** | PV routes return aggregates and product-shaped fields — not event arrays, not `secretKey`, not unrelated visitors’ data. |

## Internal-only (not PV product surfaces)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/analytics/track` | Anonymous event ingestion for funnels / ops. Taxonomy may evolve independently. |
| `GET /api/user/analytics` | Authenticated legacy lifetime summary (`AuthGuard`). |
| `GET /api/user/analytics/overview` | Authenticated time-bounded internal dashboard aggregates (`AuthGuard`). **Not** for PV. |

## PV-safe public APIs

| Endpoint | Purpose |
|----------|---------|
| `POST /api/public/visitor-quota/summary` | Global quota buckets for this `platformVisitorId` (preview, trial runtime, showcase runtime). |
| `POST /api/public/visitor-bot/summary` | Visitor-owned bot metadata + usage context for a bot **owned** by this PV. |
| `POST /api/public/visitor-bot/basic-insights` | Conversation / message counts and last activity for an owned bot. |
| `POST /api/public/visitor-bot/leads-summary` | Aggregate lead-capture stats (counts only — no PII). |

All PV-safe routes:

- Require a valid `platformVisitorId` format (see `widget-embed-identity.util.ts`).
- For bot-scoped routes, require `botId` and verify `ownerVisitorId === platformVisitorId` and `type === 'visitor-own'`.
- Are rate-limited per IP like other anonymous public helpers.

## Landing UI (assistrio-landing-site)

| Component | PV-safe endpoints |
|-----------|-------------------|
| `components/visitor/quota-summary-card.tsx` | `POST /api/public/visitor-quota/summary` |
| `components/visitor/pv-trial-bot-summary.tsx` | `POST /api/public/visitor-bot/summary`, `basic-insights`, `leads-summary` (trial success handoff only) |
| `components/visitor/pv-trial-resume-section.tsx` | Same three endpoints when the landing app restores a **locally remembered** `botId` for the active `platformVisitorId` (`lib/identity/pv-last-trial-bot.ts`) — not a server account |

These call **only** the routes in the table above — not `GET /api/user/analytics/*`, not raw `VisitorEvent` exports.

## Related

- [ANALYTICS_BOUNDARIES.md](./ANALYTICS_BOUNDARIES.md) — three-layer model (ingestion / internal / PV-safe).
- `docs/CORS.md` — strict vs broad browser CORS; `/api/public/visitor-bot/*` is **strict** (same class as `visitor-quota`).
- `assistrio-landing-site/docs/PRODUCT_MODEL.md` — landing product model.
- **`docs/INTERNAL_ANALYTICS.md`** — authenticated admin/operator analytics (overview, funnels, reporting). **Do not** confuse with PV-safe routes in this document.
