import type { ApiErrorBody, ApiResult } from './types';
import { notifyAdminFetchUnauthorized } from './adminSessionUnauthorized';

const ADMIN_PREFIX = '/api/admin';

export function getAdminApiOrigin(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (raw) return raw;
  if (import.meta.env.DEV) return 'http://localhost:3001';
  throw new Error('VITE_API_BASE_URL is required for production builds');
}

function apiBaseUrl(): string {
  return getAdminApiOrigin();
}

function assertAdminPath(path: string): void {
  if (!path.startsWith(ADMIN_PREFIX)) {
    throw new Error(`Admin API paths must start with ${ADMIN_PREFIX}, got: ${path}`);
  }
}

function buildUrl(path: string): string {
  assertAdminPath(path);
  const base = apiBaseUrl();
  if (!base) {
    throw new Error('VITE_API_BASE_URL is not set');
  }
  return `${base}${path}`;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessageFromBody(body: unknown, fallback: string): { error: string; errorCode?: string } {
  if (body && typeof body === 'object' && 'error' in body) {
    const b = body as ApiErrorBody;
    const msg = typeof b.error === 'string' && b.error.trim() ? b.error.trim() : fallback;
    const code = typeof b.errorCode === 'string' && b.errorCode.trim() ? b.errorCode.trim() : undefined;
    return { error: msg, errorCode: code };
  }
  return { error: fallback };
}

export type AdminFetchOptions = {
  /** When true, 401 does not trigger global session invalidation (e.g. logout). */
  skipSessionUnauthorizedHandling?: boolean;
};

const inFlightAdminGets = new Map<string, Promise<ApiResult<unknown>>>();

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  options?: AdminFetchOptions,
): Promise<ApiResult<T>> {
  assertAdminPath(path);
  const method = (init.method ?? 'GET').toUpperCase();
  const canDedupe = method === 'GET' && init.body == null;
  const dedupeKey = canDedupe ? `GET:${path}` : null;

  if (dedupeKey) {
    const existing = inFlightAdminGets.get(dedupeKey);
    if (existing) {
      return existing as Promise<ApiResult<T>>;
    }
  }

  const promise = (async (): Promise<ApiResult<T>> => {
    let res: Response;
    try {
      res = await fetch(buildUrl(path), {
        ...init,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      return { ok: false, status: 0, error: msg, body: null };
    }

    const body = await readJson(res);
    if (res.ok) {
      return { ok: true, data: body as T, status: res.status };
    }
    notifyAdminFetchUnauthorized(res.status, path, {
      skip: options?.skipSessionUnauthorizedHandling === true,
    });
    const { error, errorCode } = errorMessageFromBody(body, res.statusText || 'Request failed');
    return { ok: false, status: res.status, error, errorCode, body };
  })();

  if (dedupeKey) {
    inFlightAdminGets.set(dedupeKey, promise as Promise<ApiResult<unknown>>);
    void promise.finally(() => {
      inFlightAdminGets.delete(dedupeKey);
    });
  }

  return promise;
}
