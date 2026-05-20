import { adminFetch } from './client';
import { getAdminApiOrigin } from './client';
import type {
  AdminOpenAiTestKeyResponse,
  AdminOpenAiTestPlatformKeyResponse,
  BackendHealthResponse,
} from './adminSettingsTypes';
import type { ApiResult } from './types';

const OPENAI_BASE = '/api/admin/openai';

/** Tests server OPENAI_API_KEY — key is never sent or returned. */
export function testAdminOpenAiPlatformKey() {
  return adminFetch<AdminOpenAiTestPlatformKeyResponse>(`${OPENAI_BASE}/test-platform-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

/** Validates a user-supplied key (e.g. before saving to a bot). Key is not stored by this API. */
export function testAdminOpenAiKey(apiKey: string) {
  return adminFetch<AdminOpenAiTestKeyResponse>(`${OPENAI_BASE}/test-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
}

/** Public GET /health (not under /api/admin). */
export async function getBackendHealth(): Promise<ApiResult<BackendHealthResponse>> {
  const start = performance.now();
  try {
    const base = getAdminApiOrigin();
    const res = await fetch(`${base}/health`, { method: 'GET', headers: { Accept: 'application/json' } });
    const elapsed = Math.round(performance.now() - start);
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
    if (res.ok && body && typeof body === 'object') {
      const b = body as { status?: string; timestamp?: string };
      return {
        ok: true,
        status: res.status,
        data: {
          status: String(b.status ?? 'ok'),
          timestamp: typeof b.timestamp === 'string' ? b.timestamp : undefined,
          responseTimeMs: elapsed,
        },
      };
    }
    const err =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? String((body as { error: string }).error)
        : res.statusText || 'Health check failed';
    return { ok: false, status: res.status, error: err, body };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, status: 0, error: msg, body: null };
  }
}
