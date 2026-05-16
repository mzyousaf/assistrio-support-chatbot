import {
  isBrowserOriginAllowedForCors,
  isReflectablePublicEmbedOrigin,
  isSharedPreviewBrowserOriginAllowed,
} from './cors-origin.util';

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

describe('isSharedPreviewBrowserOriginAllowed', () => {
  const prevCustomer = process.env.CUSTOMER_APP_BASE_URL;
  const prevLanding = process.env.LANDING_SITE_BASE_URL;

  afterEach(() => {
    if (prevCustomer === undefined) delete process.env.CUSTOMER_APP_BASE_URL;
    else process.env.CUSTOMER_APP_BASE_URL = prevCustomer;
    if (prevLanding === undefined) delete process.env.LANDING_SITE_BASE_URL;
    else process.env.LANDING_SITE_BASE_URL = prevLanding;
  });

  it('allows Assistrio preview origins in production', () => {
    expect(isSharedPreviewBrowserOriginAllowed('https://app.assistrio.com', 'production')).toBe(true);
  });

  it('denies arbitrary HTTPS origins in production', () => {
    expect(isSharedPreviewBrowserOriginAllowed('https://evil.example', 'production')).toBe(false);
  });

  it('allows CUSTOMER_APP_BASE_URL origin when set', () => {
    process.env.CUSTOMER_APP_BASE_URL = 'https://custom-app.example';
    expect(isSharedPreviewBrowserOriginAllowed('https://custom-app.example', 'production')).toBe(true);
    expect(isSharedPreviewBrowserOriginAllowed('https://other.example', 'production')).toBe(false);
  });

  it('allows loopback in development', () => {
    expect(isSharedPreviewBrowserOriginAllowed('http://localhost:5173', 'development')).toBe(true);
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
