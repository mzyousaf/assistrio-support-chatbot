# Analytics boundaries — ingestion vs internal vs PV-safe

One-page map for **maintainers**. Not an end-user spec.

## Three layers

| Layer | Role | HTTP (read path for “analytics-like” data) | Typical UI consumers |
|-------|------|---------------------------------------------|----------------------|
| **Ingestion** | Append-only marketing/ops events | **`POST /api/analytics/track`** (write-only for clients) | **None** — not a read API; taxonomy may evolve without notice |
| **Internal reporting** | Authenticated operator aggregates | **`GET /api/user/analytics`**, **`GET /api/user/analytics/*`** (`AuthGuard`) | **`ai-platform-app`** `/user/analytics`, `/admin/analytics` |
| **PV-safe summaries** | Anonymous product-shaped summaries | **`POST /api/public/visitor-quota/summary`**, **`POST /api/public/visitor-bot/*`** | **`assistrio-landing-site`** trial / quota / bot snapshot |

## Hard rules

1. **PV-facing product UIs** must **read** only **`/api/public/visitor-*`** for quota/bot summary data — never **`/api/user/analytics`** or raw **`VisitorEvent`** streams.
2. **Authenticated dashboards** use **`/api/user/analytics/*`** — never expose those response shapes on the landing site or as PV contracts.
3. **`POST /api/analytics/track`** is **ingestion only** — not a dashboard, not a stable read contract for PV.
4. **`chatVisitorId`** is for widget threads — **not** the identity for PV summary APIs (**`platformVisitorId`** is).

## Related docs

| Doc | Use |
|-----|-----|
| [INTERNAL_ANALYTICS.md](./INTERNAL_ANALYTICS.md) | Internal API plan, data sources, caveats |
| [PV_SAFE_PUBLIC_APIS.md](./PV_SAFE_PUBLIC_APIS.md) | PV vs internal rules, CORS posture |
| `assistrio-landing-site/docs/PRODUCT_MODEL.md` | Landing identity & which public routes the site uses |
