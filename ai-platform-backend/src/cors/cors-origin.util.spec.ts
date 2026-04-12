import { isBrowserOriginAllowedForCors, isReflectablePublicEmbedOrigin } from './cors-origin.util';

describe('isBrowserOriginAllowedForCors', () => {
  it('allows loopback in development', () => {
    expect(isBrowserOriginAllowedForCors('http://localhost:3000', 'development')).toBe(true);
    expect(isBrowserOriginAllowedForCors('http://127.0.0.1:3001', 'development')).toBe(true);
    expect(isBrowserOriginAllowedForCors('http://app.localhost:3000', 'development')).toBe(true);
  });

  it('denies non-loopback in development', () => {
    expect(isBrowserOriginAllowedForCors('https://evil.com', 'development')).toBe(false);
    expect(isBrowserOriginAllowedForCors('https://app.assistrio.com', 'development')).toBe(false);
  });

  it('allows assistrio.com and subdomains in production', () => {
    expect(isBrowserOriginAllowedForCors('https://assistrio.com', 'production')).toBe(true);
    expect(isBrowserOriginAllowedForCors('https://app.assistrio.com', 'production')).toBe(true);
    expect(isBrowserOriginAllowedForCors('https://www.assistrio.com', 'production')).toBe(true);
  });

  it('denies non-assistrio in production', () => {
    expect(isBrowserOriginAllowedForCors('http://localhost:3000', 'production')).toBe(false);
    expect(isBrowserOriginAllowedForCors('https://evil-assistrio.com.evil.com', 'production')).toBe(false);
  });
});

describe('isReflectablePublicEmbedOrigin', () => {
  it('allows https in production', () => {
    expect(isReflectablePublicEmbedOrigin('https://customer.example.com', 'production')).toBe(true);
  });

  it('denies http in production', () => {
    expect(isReflectablePublicEmbedOrigin('http://customer.example.com', 'production')).toBe(false);
  });

  it('allows loopback http in development', () => {
    expect(isReflectablePublicEmbedOrigin('http://localhost:3000', 'development')).toBe(true);
  });
});
