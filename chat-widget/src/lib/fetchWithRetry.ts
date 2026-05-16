/**
 * Retries only when `fn` throws (e.g. network error). HTTP 4xx/5xx return a Response and are not retried here.
 */
export async function fetchWithNetworkRetry(
  fn: () => Promise<Response>,
  opts?: { retries?: number; delayMs?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  const delayMs = opts?.delayMs ?? 400;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}
