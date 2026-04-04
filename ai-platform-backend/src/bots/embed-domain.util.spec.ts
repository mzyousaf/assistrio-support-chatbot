import {
  checkEmbedDomainGate,
  hostnameFromShowcaseWebsiteAllowlistStoredValue,
  normalizeUserWebsiteInputToHostname,
  parseAllowedDomainRulesFromStoredArray,
  resolveRuntimeEmbedOriginFromHeaders,
} from './embed-domain.util';

describe('normalizeUserWebsiteInputToHostname', () => {
  it('accepts bare hostname and lowercases', () => {
    expect(normalizeUserWebsiteInputToHostname('WWW.App.NoTech.COM')).toBe('www.app.notech.com');
  });

  it('strips https scheme, path, query, hash, default port', () => {
    expect(normalizeUserWebsiteInputToHostname('https://www.app.notech.com/path?x=1#y')).toBe('www.app.notech.com');
    expect(normalizeUserWebsiteInputToHostname('https://www.app.notech.com:443/path?x=1#y')).toBe('www.app.notech.com');
  });

  it('strips path when pasted without scheme', () => {
    expect(normalizeUserWebsiteInputToHostname('www.app.notech.com/path')).toBe('www.app.notech.com');
  });

  it('rejects empty and overlong input', () => {
    expect(normalizeUserWebsiteInputToHostname('')).toBeNull();
    expect(normalizeUserWebsiteInputToHostname('   ')).toBeNull();
    expect(normalizeUserWebsiteInputToHostname(`${'a'.repeat(2049)}.com`)).toBeNull();
  });

  it('rejects invalid host', () => {
    expect(normalizeUserWebsiteInputToHostname('not a url')).toBeNull();
    expect(normalizeUserWebsiteInputToHostname('https://')).toBeNull();
  });

  it('rejects loopback hosts', () => {
    expect(normalizeUserWebsiteInputToHostname('http://localhost:3000')).toBeNull();
    expect(normalizeUserWebsiteInputToHostname('127.0.0.1')).toBeNull();
  });
});

describe('hostnameFromShowcaseWebsiteAllowlistStoredValue', () => {
  it('reads hostname from new hostname-only storage', () => {
    expect(hostnameFromShowcaseWebsiteAllowlistStoredValue('www.app.notech.com')).toBe('www.app.notech.com');
  });

  it('reads hostname from legacy canonical origin strings', () => {
    expect(hostnameFromShowcaseWebsiteAllowlistStoredValue('https://www.app.notech.com:8443')).toBe('www.app.notech.com');
  });
});

describe('runtime: origin hostname matches stored trial hostname', () => {
  it('matches request Origin host to allowedDomains domain rule', () => {
    const rules = parseAllowedDomainRulesFromStoredArray(['www.app.notech.com']);
    expect(checkEmbedDomainGate(rules, 'https://www.app.notech.com/foo').ok).toBe(true);
    expect(checkEmbedDomainGate(rules, 'https://www.app.notech.com:443/bar').ok).toBe(true);
    expect(checkEmbedDomainGate(rules, 'https://other.app.notech.com').ok).toBe(false);
  });
});

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
