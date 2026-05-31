import type { ApiErrorBody, ApiResult } from './types';
import { formatCustomerFacingAgentText } from '@/lib/customerAgentTerminology';
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
    return { error: formatCustomerFacingAgentText(msg), errorCode: code };
  }
  return { error: formatCustomerFacingAgentText(fallback) };
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header?.trim()) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const quotedMatch = /filename="([^"]+)"/i.exec(header);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();
  const plainMatch = /filename=([^;]+)/i.exec(header);
  return plainMatch?.[1]?.trim() ?? null;
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

/** Fetch a billing invoice document: JSON provider URL or PDF attachment. */
export async function customerFetchBlob(
  path: string,
  init: RequestInit = {},
  options?: CustomerFetchOptions,
): Promise<
  ApiResult<
    | { kind: 'pdf'; blob: Blob; filename: string }
    | { kind: 'provider_url'; url: string; source?: string }
  >
> {
  assertCustomerPath(path);

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/pdf, application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, status: 0, error: msg, body: null };
  }

  const contentType = res.headers.get('Content-Type') ?? '';

  if (!res.ok) {
    const body = await readJson(res);
    notifyCustomerFetchUnauthorized(res.status, path, {
      skip: options?.skipSessionUnauthorizedHandling === true,
    });
    const { error, errorCode } = errorMessageFromBody(body, res.statusText || 'Request failed');
    return { ok: false, status: res.status, error, errorCode, body };
  }

  if (contentType.includes('application/json')) {
    const body = await readJson(res);
    if (
      body &&
      typeof body === 'object' &&
      (body as { mode?: string }).mode === 'provider_url' &&
      typeof (body as { url?: string }).url === 'string'
    ) {
      const providerBody = body as { url: string; source?: string };
      return {
        ok: true,
        status: res.status,
        data: {
          kind: 'provider_url',
          url: providerBody.url,
          source: providerBody.source,
        },
      };
    }

    const { error, errorCode } = errorMessageFromBody(
      body,
      'Invoice PDF is not available right now.',
    );
    return {
      ok: false,
      status: res.status,
      error: error ?? 'Invoice PDF is not available right now.',
      errorCode: errorCode ?? 'billing_invoice_pdf_unavailable',
      body,
    };
  }

  if (!contentType.includes('application/pdf')) {
    return {
      ok: false,
      status: res.status,
      error: 'Invoice PDF is not available right now.',
      errorCode: 'billing_invoice_pdf_unavailable',
      body: null,
    };
  }

  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get('Content-Disposition')) ??
    'assistrio-invoice.pdf';

  return { ok: true, data: { kind: 'pdf', blob, filename }, status: res.status };
}

/** Fetch a CSV attachment with session cookies; JSON error bodies are parsed on failure. */
export async function customerFetchCsv(
  path: string,
  init: RequestInit = {},
  options?: CustomerFetchOptions,
): Promise<ApiResult<{ blob: Blob; filename: string }>> {
  assertCustomerPath(path);

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'text/csv, application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, status: 0, error: msg, body: null };
  }

  const contentType = res.headers.get('Content-Type') ?? '';

  if (!res.ok) {
    const body = await readJson(res);
    notifyCustomerFetchUnauthorized(res.status, path, {
      skip: options?.skipSessionUnauthorizedHandling === true,
    });
    const { error, errorCode } = errorMessageFromBody(body, res.statusText || 'Request failed');
    return { ok: false, status: res.status, error, errorCode, body };
  }

  if (contentType.includes('application/json')) {
    const body = await readJson(res);
    const { error, errorCode } = errorMessageFromBody(body, 'Could not download billing history.');
    return {
      ok: false,
      status: res.status,
      error: error ?? 'Could not download billing history.',
      errorCode,
      body,
    };
  }

  if (!contentType.includes('text/csv')) {
    return {
      ok: false,
      status: res.status,
      error: 'Could not download billing history.',
      body: null,
    };
  }

  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get('Content-Disposition')) ??
    'assistrio-billing-history.csv';

  return { ok: true, data: { blob, filename }, status: res.status };
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
