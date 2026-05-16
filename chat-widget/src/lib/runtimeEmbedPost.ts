/**
 * Runtime embed: prefer HttpOnly session cookie from `/api/widget/init` (no keys in body).
 * If the server responds 403 with invalid key codes (e.g. older deploy or cookie blocked), retry once with keys.
 */
export async function runtimeEmbedPost(
  url: string,
  bodyWithoutKeys: Record<string, unknown>,
  keys: { accessKey?: string; secretKey?: string },
  init?: Omit<RequestInit, "body" | "method">,
): Promise<Response> {
  const mergedHeaders = new Headers({ "Content-Type": "application/json" });
  const extra = init?.headers;
  if (extra) {
    new Headers(extra).forEach((value, key) => mergedHeaders.set(key, value));
  }
  const base: RequestInit = {
    method: "POST",
    headers: mergedHeaders,
    credentials: "include",
    ...init,
  };
  const res = await fetch(url, {
    ...base,
    body: JSON.stringify(bodyWithoutKeys),
  });
  if (res.ok || res.status !== 403) return res;
  const data = (await res.clone().json().catch(() => ({}))) as { errorCode?: string };
  const code = typeof data.errorCode === "string" ? data.errorCode : "";
  if (code !== "INVALID_ACCESS_KEY" && code !== "INVALID_SECRET_KEY") return res;
  return fetch(url, {
    ...base,
    body: JSON.stringify({
      ...bodyWithoutKeys,
      ...(keys.accessKey ? { accessKey: keys.accessKey } : {}),
      ...(keys.secretKey ? { secretKey: keys.secretKey } : {}),
    }),
  });
}
