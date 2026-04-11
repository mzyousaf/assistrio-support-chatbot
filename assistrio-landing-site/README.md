# Assistrio marketing site (`assistrio-landing-site`)

Next.js app for the public marketing site: showcase gallery, free trial, identity/quota UX, and runtime demo embeds.

## Product model (read this first)

**[`docs/PRODUCT_MODEL.md`](./docs/PRODUCT_MODEL.md)** — stable id vs chat id, preview vs runtime, showcase vs trial, and honest limits of the anonymous model. Backend mirror: `ai-platform-backend/src/bots/widget-embed-identity.util.ts`.

## Release & QA

**[`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md)** — code audit summary, manual QA steps, env/deploy checklist (including backend `CORS_EXTRA_ORIGINS` and `TRUST_PROXY`), post-launch monitoring, and ship recommendation.

**[`docs/RUNTIME_DEPLOYMENT.md`](./docs/RUNTIME_DEPLOYMENT.md)** — **customer-site widget runtime**: CORS vs embed rules, verification checklist, failure diagnosis (CORS vs 403 init).

## Environment

- **`NEXT_PUBLIC_API_BASE_URL`** — Assistrio API origin (required for gallery, quota, trial, snippets).
- **`NEXT_PUBLIC_ASSISTRIO_WIDGET_JS_URL`** / **`NEXT_PUBLIC_ASSISTRIO_WIDGET_CSS_URL`** — optional overrides for widget CDN URLs (see `lib/widget/cdn-urls.ts`).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

## Stack

Next.js 15 (App Router), TypeScript, Tailwind.
