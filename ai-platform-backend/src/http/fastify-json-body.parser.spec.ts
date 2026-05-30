import Fastify from 'fastify';
import {
  isLemonWebhookUrl,
  registerLemonWebhookRawBodyPreParsingHook,
  resolveWebhookRawBody,
  streamToBuffer,
  type FastifyPreParsingHookHost,
  type FastifyRequestWithRawBody,
} from './fastify-json-body.parser';

describe('registerLemonWebhookRawBodyPreParsingHook', () => {
  async function createTestApp() {
    const app = Fastify();
    registerLemonWebhookRawBodyPreParsingHook(app as unknown as FastifyPreParsingHookHost);

    app.post('/api/billing/webhooks/lemon-squeezy', async (request) => {
      const req = request as FastifyRequestWithRawBody;
      return {
        parsed: request.body,
        rawBody: resolveWebhookRawBody(req)?.toString('utf8') ?? null,
        rawOnIncoming: (request.raw as { rawBody?: Buffer }).rawBody?.toString('utf8') ?? null,
      };
    });

    app.post('/api/customer/workspaces/ws-1/billing/summary', async (request) => {
      const req = request as FastifyRequestWithRawBody;
      return {
        parsed: request.body,
        hasRawBody: resolveWebhookRawBody(req) != null,
      };
    });

    await app.ready();
    return app;
  }

  it('isLemonWebhookUrl matches lemon webhook route', () => {
    expect(isLemonWebhookUrl('/api/billing/webhooks/lemon-squeezy')).toBe(true);
    expect(isLemonWebhookUrl('/api/customer/foo')).toBe(false);
  });

  it('streamToBuffer reads full stream', async () => {
    const { Readable } = await import('node:stream');
    const buffer = await streamToBuffer(Readable.from([Buffer.from('ab'), 'cd']));
    expect(buffer.toString('utf8')).toBe('abcd');
  });

  it('Lemon webhook has rawBody on request and request.raw with parsed JSON body', async () => {
    const app = await createTestApp();
    const payload = JSON.stringify({
      meta: {
        event_name: 'subscription_payment_success',
        custom_data: { workspaceId: 'ws-1', checkoutType: 'plan', planKey: 'starter' },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/billing/webhooks/lemon-squeezy',
      headers: { 'content-type': 'application/json' },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      parsed: { meta: { event_name: string } };
      rawBody: string;
      rawOnIncoming: string;
    };
    expect(body.parsed.meta.event_name).toBe('subscription_payment_success');
    expect(body.rawBody).toBe(payload);
    expect(body.rawOnIncoming).toBe(payload);
    await app.close();
  });

  it('normal JSON routes parse body and are unaffected by webhook raw capture', async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/customer/workspaces/ws-1/billing/summary',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ workspaceId: 'ws-1' }),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      parsed: { workspaceId: string };
      hasRawBody: boolean;
    };
    expect(body.parsed).toEqual({ workspaceId: 'ws-1' });
    expect(body.hasRawBody).toBe(false);
    await app.close();
  });
});
