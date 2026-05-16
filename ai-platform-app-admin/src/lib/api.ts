const baseUrl =
  typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string" &&
  process.env.NEXT_PUBLIC_API_BASE_URL.trim() !== ""
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim().replace(/\/$/, "")
    : "";

function getApiUrl(path: string): string {
  return baseUrl ? `${baseUrl}${path.startsWith("/") ? path : `/${path}`}` : path;
}

/**
 * Fetch from the configured API base URL. Use in client components.
 * If NEXT_PUBLIC_API_BASE_URL is set, requests go to the backend; otherwise same-origin.
 */
export function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(getApiUrl(path), { ...init, credentials: "include" });
}

/**
 * Server-side fetch to the backend with optional cookie forwarding (for SSR auth).
 * Use in server components and server actions. Pass cookie from next/headers cookies().
 */
export async function serverApiFetch(
  path: string,
  options?: RequestInit & { cookie?: string },
): Promise<Response> {
  const { cookie, ...init } = options ?? {};
  const headers = new Headers(init?.headers);
  if (cookie) headers.set("Cookie", cookie);
  return fetch(getApiUrl(path), { ...init, headers });
}
