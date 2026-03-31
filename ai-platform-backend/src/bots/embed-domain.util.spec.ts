import { resolveRuntimeEmbedOriginFromHeaders } from './embed-domain.util';

describe('resolveRuntimeEmbedOriginFromHeaders', () => {
  it('returns Origin when present', () => {
    const resolved = resolveRuntimeEmbedOriginFromHeaders({
      origin: 'https://trusted.example',
    });
    expect(resolved).toBe('https://trusted.example');
  });

  it('does not use Referer when Origin is missing', () => {
    const resolved = resolveRuntimeEmbedOriginFromHeaders({
      referer: 'https://app.customer.com/page?q=1',
    });
    expect(resolved).toBeUndefined();
  });

  it('does not use JSON body (callers pass headers only)', () => {
    const resolved = resolveRuntimeEmbedOriginFromHeaders({});
    expect(resolved).toBeUndefined();
  });

  it('prefers first Origin value when multiple', () => {
    const resolved = resolveRuntimeEmbedOriginFromHeaders({
      origin: ['https://a.example', 'https://b.example'],
    });
    expect(resolved).toBe('https://a.example');
  });
});
