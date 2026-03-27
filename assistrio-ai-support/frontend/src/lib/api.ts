/** Matches backend local default in `.env.example` when `NEXT_PUBLIC_API_BASE_URL` is missing. */
const DEV_FALLBACK_API_BASE = 'http://localhost:8090';

/**
 * Public Nest API origin (no trailing slash).
 * Prefer `NEXT_PUBLIC_API_BASE_URL`; in development only, fall back to `DEV_FALLBACK_API_BASE`
 * so requests do not go to the Next.js host by mistake.
 */
function resolvePublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    return DEV_FALLBACK_API_BASE;
  }
  return '';
}

function getApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const base = resolvePublicApiBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

/** Resolved API origin for UI and embed config (see `resolvePublicApiBaseUrl`). */
export function getApiBaseUrl(): string {
  return resolvePublicApiBaseUrl();
}

/**
 * Fetch from the Nest backend. Set `NEXT_PUBLIC_API_BASE_URL` (e.g. http://localhost:3001).
 * Uses `credentials: "include"` so `user_token` cookie from `POST /api/user/login` is sent.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(getApiUrl(path), { ...init, credentials: 'include' });
}

/**
 * Server-side fetch to the backend with optional cookie forwarding (SSR / Route Handlers).
 */
export async function serverApiFetch(
  path: string,
  options?: RequestInit & { cookie?: string },
): Promise<Response> {
  const { cookie, ...init } = options ?? {};
  const headers = new Headers(init?.headers);
  if (cookie) headers.set('Cookie', cookie);
  return fetch(getApiUrl(path), { ...init, headers });
}
