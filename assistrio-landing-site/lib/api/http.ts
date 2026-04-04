import { AssistrioApiError } from "@/types/api";

type ErrorBody = {
  error?: string;
  errorCode?: string;
  status?: string;
  deploymentHint?: string;
  retryAfterSeconds?: number;
};

export async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const eb = (parsed ?? {}) as ErrorBody;
    const hint = typeof eb.deploymentHint === "string" ? eb.deploymentHint.trim() : undefined;
    const retry =
      typeof eb.retryAfterSeconds === "number" && Number.isFinite(eb.retryAfterSeconds)
        ? eb.retryAfterSeconds
        : undefined;
    throw new AssistrioApiError(eb.error ?? `Request failed (${res.status})`, {
      status: res.status,
      errorCode: eb.errorCode,
      deploymentHint: hint,
      retryAfterSeconds: retry,
      body: parsed,
    });
  }
  return (parsed ?? {}) as T;
}
