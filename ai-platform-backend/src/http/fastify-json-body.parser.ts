import { Readable } from 'node:stream';
import type { FastifyRequest } from 'fastify';

export const LEMON_WEBHOOK_PATH = '/api/billing/webhooks/lemon-squeezy';

export type FastifyRequestWithRawBody = FastifyRequest & {
  rawBody?: Buffer;
  bodyRaw?: Buffer;
};

type RawBodyCarrier = {
  rawBody?: Buffer;
  bodyRaw?: Buffer;
};

type ReadablePayload = NodeJS.ReadableStream & { receivedEncodedLength?: number };

/** Minimal Fastify surface for registering the Lemon webhook preParsing hook. */
export type FastifyPreParsingHookHost = {
  addHook(
    name: 'preParsing',
    hook: (
      request: FastifyRequest,
      reply: unknown,
      payload: ReadablePayload,
    ) => Promise<ReadablePayload> | ReadablePayload,
  ): void;
};

export function isLemonWebhookUrl(url: string | undefined): boolean {
  return String(url ?? '').includes(LEMON_WEBHOOK_PATH);
}

export async function streamToBuffer(payload: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of payload) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Attach raw bytes for HMAC verification (Fastify request + Node IncomingMessage). */
export function attachRawBodyToRequest(request: FastifyRequest, body: Buffer): void {
  const req = request as FastifyRequestWithRawBody;
  req.rawBody = body;
  req.bodyRaw = body;

  const incoming = request.raw as RawBodyCarrier | undefined;
  if (incoming) {
    incoming.rawBody = body;
    incoming.bodyRaw = body;
  }
}

/** Resolve raw body from Nest/Fastify request shapes. */
export function resolveWebhookRawBody(
  req: Pick<FastifyRequestWithRawBody, 'rawBody' | 'bodyRaw'> & {
    raw?: RawBodyCarrier | unknown;
  },
): Buffer | undefined {
  const rawCarrier = req.raw as RawBodyCarrier | undefined;
  const candidates = [req.rawBody, req.bodyRaw, rawCarrier?.rawBody, rawCarrier?.bodyRaw];
  for (const candidate of candidates) {
    if (Buffer.isBuffer(candidate) && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
}

function requestUrl(request: FastifyRequest): string {
  const rawUrl = (request.raw as { url?: string } | undefined)?.url;
  return String(rawUrl ?? request.url ?? '');
}

/**
 * Captures exact raw bytes for Lemon webhooks via preParsing, then returns a cloned stream
 * so Fastify's default JSON parser can run unchanged.
 */
export function registerLemonWebhookRawBodyPreParsingHook(fastify: FastifyPreParsingHookHost): void {
  fastify.addHook('preParsing', async (request, _reply, payload) => {
    const url = requestUrl(request);
    if (!isLemonWebhookUrl(url)) {
      return payload;
    }

    const rawBody = await streamToBuffer(payload);
    attachRawBodyToRequest(request, rawBody);

    const clonedPayload = Readable.from(rawBody) as ReadablePayload;
    clonedPayload.receivedEncodedLength = rawBody.length;

    return clonedPayload;
  });
}
