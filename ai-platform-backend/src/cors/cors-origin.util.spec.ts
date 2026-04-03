import { isBrowserOriginAllowedForCors, parseCorsExtraOriginsEnv } from './cors-origin.util';

describe('parseCorsExtraOriginsEnv', () => {
  it('parses comma-separated origins', () => {
    const s = parseCorsExtraOriginsEnv('https://a.com/, https://b.com:8080');
    expect(s.has('https://a.com')).toBe(true);
    expect(s.has('https://b.com:8080')).toBe(true);
  });
});

describe('isBrowserOriginAllowedForCors', () => {
  const empty = new Set<string>();

  it('allows loopback in development', () => {
    expect(isBrowserOriginAllowedForCors('http://localhost:3000', 'development', empty)).toBe(true);
    expect(isBrowserOriginAllowedForCors('http://127.0.0.1:3001', 'development', empty)).toBe(true);
    expect(isBrowserOriginAllowedForCors('http://app.localhost:3000', 'development', empty)).toBe(true);
  });

  it('denies non-loopback in development', () => {
    expect(isBrowserOriginAllowedForCors('https://evil.com', 'development', empty)).toBe(false);
    expect(isBrowserOriginAllowedForCors('https://app.assistrio.com', 'development', empty)).toBe(false);
  });

  it('allows assistrio.com and subdomains in production', () => {
    expect(isBrowserOriginAllowedForCors('https://assistrio.com', 'production', empty)).toBe(true);
    expect(isBrowserOriginAllowedForCors('https://app.assistrio.com', 'production', empty)).toBe(true);
    expect(isBrowserOriginAllowedForCors('https://www.assistrio.com', 'production', empty)).toBe(true);
  });

  it('denies non-assistrio in production', () => {
    expect(isBrowserOriginAllowedForCors('http://localhost:3000', 'production', empty)).toBe(false);
    expect(isBrowserOriginAllowedForCors('https://evil-assistrio.com.evil.com', 'production', empty)).toBe(
      false,
    );
  });

  it('allows extra origins in any env', () => {
    const extra = new Set(['https://partner.example']);
    expect(isBrowserOriginAllowedForCors('https://partner.example', 'production', extra)).toBe(true);
    expect(isBrowserOriginAllowedForCors('https://partner.example', 'development', extra)).toBe(true);
  });
});
