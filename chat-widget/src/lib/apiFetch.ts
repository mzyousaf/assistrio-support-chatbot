/**
 * Minimal same-origin API fetch for {@link AdminLiveChatAdapter} when `apiBaseUrl` is not set.
 * Does not require NEXT_PUBLIC_* or any env var: resolves relative `/api/...` paths against the current page origin.
 */

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, { ...init, credentials: "include" });
}
