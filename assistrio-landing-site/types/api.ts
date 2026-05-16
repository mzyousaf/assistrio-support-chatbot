/**
 * Shared API error type for client-side fetch helpers.
 */

export class AssistrioApiError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  /** Present on some API errors (e.g. widget-style hints); never contains secrets. */
  readonly deploymentHint?: string;
  /** Suggested wait before retry (e.g. HTTP 429 `RATE_LIMITED`). */
  readonly retryAfterSeconds?: number;
  readonly body: unknown;

  constructor(
    message: string,
    opts: {
      status: number;
      errorCode?: string;
      deploymentHint?: string;
      retryAfterSeconds?: number;
      body?: unknown;
    },
  ) {
    super(message);
    this.name = "AssistrioApiError";
    this.status = opts.status;
    this.errorCode = opts.errorCode;
    this.deploymentHint = opts.deploymentHint;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.body = opts.body;
  }
}
