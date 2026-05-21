import {
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  normalizeSessionCookieDomain,
} from './auth-cookie.util';

const SECURITY = 'HttpOnly; SameSite=Lax';

describe('normalizeSessionCookieDomain', () => {
  it('returns undefined for empty or whitespace', () => {
    expect(normalizeSessionCookieDomain(undefined)).toBeUndefined();
    expect(normalizeSessionCookieDomain('')).toBeUndefined();
    expect(normalizeSessionCookieDomain('   ')).toBeUndefined();
  });

  it('returns trimmed domain when set', () => {
    expect(normalizeSessionCookieDomain(' .assistrio.com ')).toBe('.assistrio.com');
  });
});

describe('buildSessionSetCookieHeader', () => {
  it('omits Domain when cookieDomain is not provided', () => {
    const header = buildSessionSetCookieHeader('ar_customer_session', 'jwt-token', 3600, SECURITY);
    expect(header).toBe(
      'ar_customer_session=jwt-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600',
    );
    expect(header).not.toContain('Domain=');
  });

  it('includes Domain when SESSION_COOKIE_DOMAIN is passed', () => {
    const header = buildSessionSetCookieHeader(
      'ar_customer_session',
      'jwt-token',
      604800,
      SECURITY,
      '.assistrio.com',
    );
    expect(header).toContain('Path=/; Domain=.assistrio.com;');
    expect(header).toContain('Max-Age=604800');
  });

  it('omits Domain when cookieDomain is empty string', () => {
    const header = buildSessionSetCookieHeader('ar_customer_session', 't', 60, SECURITY, '');
    expect(header).not.toContain('Domain=');
  });
});

describe('buildSessionClearCookieHeader', () => {
  it('omits Domain when cookieDomain is not provided', () => {
    const header = buildSessionClearCookieHeader('ar_customer_session', SECURITY);
    expect(header).toBe('ar_customer_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    expect(header).not.toContain('Domain=');
  });

  it('includes Domain when SESSION_COOKIE_DOMAIN is passed', () => {
    const header = buildSessionClearCookieHeader(
      'ar_customer_session',
      SECURITY,
      '.assistrio.com',
    );
    expect(header).toBe(
      'ar_customer_session=; Path=/; Domain=.assistrio.com; Max-Age=0; HttpOnly; SameSite=Lax',
    );
  });

  it('omits Domain when cookieDomain is empty string', () => {
    const header = buildSessionClearCookieHeader('ar_customer_session', SECURITY, '  ');
    expect(header).not.toContain('Domain=');
  });
});
