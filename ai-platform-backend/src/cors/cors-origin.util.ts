import { hostnameIsLoopbackForEmbedBypass } from '../bots/embed-domain.util';

/**
 * Optional comma-separated absolute origins (e.g. `https://client.com,https://app.client.com`)
 * for embed/widget traffic when the browser `Origin` is not on assistrio.com.
 * Production defaults to assistrio.com (+ subdomains) only; use this for third-party embeds.
 */
export function parseCorsExtraOriginsEnv(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  const set = new Set<string>();
  for (const part of raw.split(',')) {
    const o = part.trim();
    if (!o) continue;
    try {
      set.add(new URL(o).origin);
    } catch {
      /* skip invalid */
    }
  }
  return set;
}

function isAssistrioHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'assistrio.com' || h.endsWith('.assistrio.com');
}

/**
 * CORS allowlist:
 * - **development** (`NODE_ENV === 'development'`): loopback / local dev origins only (localhost, 127.0.0.1, ::1, `*.localhost`).
 * - **else**: `assistrio.com` and any `*.assistrio.com` origin.
 * - **Any env**: origins listed in `CORS_EXTRA_ORIGINS` (exact `URL#origin` match).
 */
export function isBrowserOriginAllowedForCors(
  origin: string,
  nodeEnv: string,
  extraOrigins: Set<string>,
): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (extraOrigins.has(url.origin)) return true;
  const host = url.hostname;
  if (nodeEnv === 'development') {
    return hostnameIsLoopbackForEmbedBypass(host);
  }
  return isAssistrioHostname(host);
}
