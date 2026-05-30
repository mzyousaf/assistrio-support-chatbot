import type { Logger } from '@nestjs/common';

type LemonWebhookLogPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
  };
};

export function logLemonWebhookReceived(
  logger: Logger,
  input: {
    hasRawBody: boolean;
    rawBodyLength: number;
    parsedBody?: unknown;
  },
): void {
  const payload =
    input.parsedBody && typeof input.parsedBody === 'object'
      ? (input.parsedBody as LemonWebhookLogPayload)
      : undefined;
  const custom = payload?.meta?.custom_data ?? {};

  logger.log(
    JSON.stringify({
      billingWebhook: 'received',
      eventName: String(payload?.meta?.event_name ?? '').trim() || 'unknown',
      hasRawBody: input.hasRawBody,
      rawBodyLength: input.rawBodyLength,
      workspaceId: String(custom.workspaceId ?? custom.workspace_id ?? '').trim() || null,
      checkoutType: String(custom.checkoutType ?? '').trim() || null,
      planKey: String(custom.planKey ?? '').trim() || null,
      dataType: String(payload?.data?.type ?? '').trim() || null,
    }),
  );
}

export function logBillingWebhookProcessed(
  logger: Logger,
  input: {
    eventId: string;
    eventName: string;
    provider: string;
    workspaceId?: string | null;
    status: string;
  },
): void {
  logger.log(
    JSON.stringify({
      billingWebhook: 'processed',
      eventId: input.eventId,
      eventName: input.eventName,
      provider: input.provider,
      workspaceId: input.workspaceId?.trim() || null,
      status: input.status,
    }),
  );
}

export function logBillingWebhookFailed(
  logger: Logger,
  input: {
    eventId: string;
    eventName: string;
    provider: string;
    workspaceId?: string | null;
    processingError: string;
  },
): void {
  logger.warn(
    JSON.stringify({
      billingWebhook: 'failed',
      eventId: input.eventId,
      eventName: input.eventName,
      provider: input.provider,
      workspaceId: input.workspaceId?.trim() || null,
      processingError: input.processingError,
    }),
  );
}

export function logBillingWebhookReplayStarted(
  logger: Logger,
  input: {
    eventId: string;
    eventName: string;
    provider: string;
    workspaceId?: string | null;
  },
): void {
  logger.log(
    JSON.stringify({
      billingWebhook: 'replay_started',
      eventId: input.eventId,
      eventName: input.eventName,
      provider: input.provider,
      workspaceId: input.workspaceId?.trim() || null,
    }),
  );
}

export function logBillingWebhookReplayCompleted(
  logger: Logger,
  input: {
    eventId: string;
    eventName: string;
    provider: string;
    workspaceId?: string | null;
    status: string;
    replayed: boolean;
  },
): void {
  logger.log(
    JSON.stringify({
      billingWebhook: 'replay_completed',
      eventId: input.eventId,
      eventName: input.eventName,
      provider: input.provider,
      workspaceId: input.workspaceId?.trim() || null,
      status: input.status,
      replayed: input.replayed,
    }),
  );
}
