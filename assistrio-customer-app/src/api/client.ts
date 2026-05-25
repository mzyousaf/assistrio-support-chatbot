import type { ApiErrorBody, ApiResult } from './types';
import { notifyCustomerFetchUnauthorized } from './customerSessionUnauthorized';

const CUSTOMER_PREFIX = '/api/customer';

export function getCustomerApiOrigin(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (raw) return raw;
  if (import.meta.env.DEV) return 'http://localhost:3001';
  throw new Error('VITE_API_BASE_URL is required for production builds');
}

function apiBaseUrl(): string {
  return getCustomerApiOrigin();
}

function assertCustomerPath(path: string): void {
  if (!path.startsWith(CUSTOMER_PREFIX)) {
    throw new Error(`Customer API paths must start with ${CUSTOMER_PREFIX}, got: ${path}`);
  }
}

function buildUrl(path: string): string {
  assertCustomerPath(path);
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
  if (body && typeof body === 'object') {
    const b = body as ApiErrorBody;
    const msg =
      (typeof b.error === 'string' && b.error.trim() ? b.error.trim() : '') ||
      (typeof b.message === 'string' && b.message.trim() ? b.message.trim() : '') ||
      fallback;
    const code = typeof b.errorCode === 'string' && b.errorCode.trim() ? b.errorCode.trim() : undefined;
    return { error: msg, errorCode: code };
  }
  return { error: fallback };
}

export type CustomerFetchOptions = {
  /** When true, 401 does not trigger global session invalidation (e.g. logout). */
  skipSessionUnauthorizedHandling?: boolean;
};

/** Coalesce identical in-flight GETs (e.g. overview + sidebar mounting together). */
const inFlightCustomerGets = new Map<string, Promise<ApiResult<unknown>>>();

/**
 * Fetch helper for the customer surface only. Always sends cookies.
 */
export async function customerFetch<T>(
  path: string,
  init: RequestInit = {},
  options?: CustomerFetchOptions,
): Promise<ApiResult<T>> {
  assertCustomerPath(path);
  const method = (init.method ?? 'GET').toUpperCase();
  const canDedupe = method === 'GET' && init.body == null;
  const dedupeKey = canDedupe ? `GET:${path}` : null;

  if (dedupeKey) {
    const existing = inFlightCustomerGets.get(dedupeKey);
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
    notifyCustomerFetchUnauthorized(res.status, path, {
      skip: options?.skipSessionUnauthorizedHandling === true,
    });
    const { error, errorCode } = errorMessageFromBody(body, res.statusText || 'Request failed');
    return { ok: false, status: res.status, error, errorCode, body };
  })();

  if (dedupeKey) {
    inFlightCustomerGets.set(dedupeKey, promise as Promise<ApiResult<unknown>>);
    void promise.finally(() => {
      inFlightCustomerGets.delete(dedupeKey);
    });
  }

  return promise;
}

export function customerGoogleAuthStartUrl(options?: {
  selectAccount?: boolean;
  inviteToken?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.selectAccount) params.set('selectAccount', '1');
  const inviteToken = String(options?.inviteToken ?? '').trim();
  if (inviteToken) params.set('inviteToken', inviteToken);
  const qs = params.toString();
  return buildUrl(`${CUSTOMER_PREFIX}/auth/google${qs ? `?${qs}` : ''}`);
}
