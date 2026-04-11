import {
  assertPlatformVisitorWebsiteMatchesBotAllowlist,
  normalizeWebsiteURLAllowlistRowPublic,
} from './platform-visitor-website-allowlist.util';

describe('normalizeWebsiteURLAllowlistRowPublic', () => {
  it('stores hostname only from full URL', () => {
    expect(
      normalizeWebsiteURLAllowlistRowPublic({
        platformVisitorId: 'pv',
        websiteUrl: 'https://www.app.notech.com/path?q=1#x',
      }),
    ).toEqual({ platformVisitorId: 'pv', websiteUrl: 'www.app.notech.com' });
  });
});

describe('assertPlatformVisitorWebsiteMatchesBotAllowlist', () => {
  const bot = {
    websiteURLAllowlist: [{ platformVisitorId: 'pv1', websiteUrl: 'www.app.notech.com' }],
  };

  it('matches Origin hostname to stored hostname (path-insensitive)', () => {
    expect(() =>
      assertPlatformVisitorWebsiteMatchesBotAllowlist({
        bot,
        platformVisitorId: 'pv1',
        requestOrigin: 'https://www.app.notech.com',
      }),
    ).not.toThrow();
    expect(() =>
      assertPlatformVisitorWebsiteMatchesBotAllowlist({
        bot,
        platformVisitorId: 'pv1',
        requestOrigin: 'https://www.app.notech.com:443',
      }),
    ).not.toThrow();
  });

  it('matches legacy stored canonical origin by hostname (same port)', () => {
    const legacy = {
      websiteURLAllowlist: [{ platformVisitorId: 'pv1', websiteUrl: 'https://www.app.notech.com:8443' }],
    };
    expect(() =>
      assertPlatformVisitorWebsiteMatchesBotAllowlist({
        bot: legacy,
        platformVisitorId: 'pv1',
        requestOrigin: 'https://www.app.notech.com:8443',
      }),
    ).not.toThrow();
  });

  it('matches legacy stored origin to default HTTPS port when hostname matches', () => {
    const legacy = {
      websiteURLAllowlist: [{ platformVisitorId: 'pv1', websiteUrl: 'https://www.app.notech.com:8443' }],
    };
    expect(() =>
      assertPlatformVisitorWebsiteMatchesBotAllowlist({
        bot: legacy,
        platformVisitorId: 'pv1',
        requestOrigin: 'https://www.app.notech.com',
      }),
    ).not.toThrow();
  });

  it('throws when hostname differs', () => {
    expect(() =>
      assertPlatformVisitorWebsiteMatchesBotAllowlist({
        bot,
        platformVisitorId: 'pv1',
        requestOrigin: 'https://other.notech.com',
      }),
    ).toThrow('PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH');
  });

  it('throws when origin missing or invalid', () => {
    expect(() =>
      assertPlatformVisitorWebsiteMatchesBotAllowlist({
        bot,
        platformVisitorId: 'pv1',
        requestOrigin: '',
      }),
    ).toThrow('PLATFORM_EMBED_ORIGIN_REQUIRED');
  });
});
