import * as approxGeo from './approx-geo-ip-lookup.util';
import {
  buildConversationAnalyticsPersistence,
  hashIpForAnalytics,
  hashUserAgentForAnalytics,
  mergeConversationDeviceInfoRecords,
  mergeConversationLocationRecords,
  parseUserAgentForDeviceInfo,
  sanitizeConversationLocationForPersistence,
  sanitizeDeviceInfoForPersistence,
} from './conversation-analytics-location-device.util';

describe('hashIpForAnalytics', () => {
  it('does not return raw IP', () => {
    const h = hashIpForAnalytics('203.0.113.10', 'test-secret');
    expect(h).toBeDefined();
    expect(h).not.toContain('203');
    expect(h).not.toContain('0.113');
  });

  it('returns undefined for unknown placeholder', () => {
    expect(hashIpForAnalytics('unknown', 'salt')).toBeUndefined();
  });
});

describe('hashUserAgentForAnalytics', () => {
  it('does not echo raw UA', () => {
    const h = hashUserAgentForAnalytics('Mozilla/5.0 (Windows NT 10.0)', 's');
    expect(h).toBeDefined();
    expect(h).not.toContain('Mozilla');
  });
});

describe('parseUserAgentForDeviceInfo', () => {
  it('detects mobile Chrome on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    const d = parseUserAgentForDeviceInfo(ua, undefined, 'secret');
    expect(d.deviceType).toBe('mobile');
    expect(d.browser).toBe('Chrome');
    expect(d.os).toBe('Android');
    expect(d.userAgentHash).toBeDefined();
  });

  it('detects desktop Safari', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    const d = parseUserAgentForDeviceInfo(ua, undefined, 'secret');
    expect(d.deviceType).toBe('desktop');
    expect(d.browser).toBe('Safari');
    expect(d.os).toBe('macOS');
  });

  it('detects bot', () => {
    const d = parseUserAgentForDeviceInfo('Googlebot/2.1 (+http://www.google.com/bot.html)', undefined, 'x');
    expect(d.deviceType).toBe('bot');
  });
});

describe('sanitizeConversationLocationForPersistence', () => {
  it('truncates long strings', () => {
    const long = 'x'.repeat(200);
    const out = sanitizeConversationLocationForPersistence({
      country: long,
      timezone: long,
      source: 'browser_timezone',
    });
    expect(String(out?.country).length).toBeLessThanOrEqual(100);
    expect(String(out?.timezone).length).toBeLessThanOrEqual(100);
  });

  it('drops invalid latitude', () => {
    const out = sanitizeConversationLocationForPersistence({
      latitudeApprox: 999,
      longitudeApprox: 10,
    });
    expect(out?.latitudeApprox).toBeUndefined();
    expect(out?.longitudeApprox).toBe(10);
  });
});

describe('sanitizeDeviceInfoForPersistence', () => {
  it('rejects out-of-range screen dimensions', () => {
    expect(sanitizeDeviceInfoForPersistence({ screenWidth: 10, screenHeight: 20000 })).toBeUndefined();
  });

  it('accepts valid screen size', () => {
    const out = sanitizeDeviceInfoForPersistence({ screenWidth: 1920, screenHeight: 1080 });
    expect(out?.screenWidth).toBe(1920);
    expect(out?.screenHeight).toBe(1080);
  });

  it('skips browser when unknown string', () => {
    const out = sanitizeDeviceInfoForPersistence({ browser: 'unknown', deviceType: 'desktop' });
    expect(out?.browser).toBeUndefined();
    expect(out?.deviceType).toBe('desktop');
  });
});

describe('mergeConversationLocationRecords', () => {
  it('fills missing keys from incoming', () => {
    const m = mergeConversationLocationRecords({ country: 'US' }, { timezone: 'Europe/Berlin' });
    expect(m?.country).toBe('US');
    expect(m?.timezone).toBe('Europe/Berlin');
  });

  it('does not overwrite existing with empty string', () => {
    const m = mergeConversationLocationRecords({ city: 'Berlin' }, { city: '   ' });
    expect(m?.city).toBe('Berlin');
  });
});

describe('mergeConversationDeviceInfoRecords', () => {
  it('upgrades unknown deviceType', () => {
    const m = mergeConversationDeviceInfoRecords({ deviceType: 'unknown' }, { deviceType: 'mobile' });
    expect(m?.deviceType).toBe('mobile');
  });
});

describe('buildConversationAnalyticsPersistence', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('combines client timezone with server ip hash', () => {
    const out = buildConversationAnalyticsPersistence({
      clientContext: {
        location: { timezone: 'America/New_York', source: 'browser_timezone' },
      },
      requestMeta: {
        clientIp: '198.51.100.2',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      },
      hashSecret: 'unit-test-secret',
    });
    expect(out.location?.timezone).toBe('America/New_York');
    expect(out.location?.source).toBe('browser_timezone');
    expect(out.location?.ipHash).toBeDefined();
    expect(out.deviceInfo?.userAgentHash).toBeDefined();
  });

  it('keeps ip_lookup when approximate geo fields exist alongside browser timezone', () => {
    jest.spyOn(approxGeo, 'lookupApproxGeoFromIpSync').mockReturnValue({
      countryCode: 'FR',
      country: 'FR',
      city: 'Paris',
      region: 'IDF',
    });
    const out = buildConversationAnalyticsPersistence({
      clientContext: { location: { timezone: 'Europe/Paris' } },
      requestMeta: {
        clientIp: '198.51.100.2',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/119.0 Safari/537.36',
      },
      hashSecret: 'unit-test-secret',
    });
    expect(out.location?.timezone).toBe('Europe/Paris');
    expect(out.location?.city).toBe('Paris');
    expect(out.location?.source).toBe('ip_lookup');
  });

  it('uses browser_timezone when only timezone is present (no approximate geo)', () => {
    jest.spyOn(approxGeo, 'lookupApproxGeoFromIpSync').mockReturnValue(null);
    const out = buildConversationAnalyticsPersistence({
      clientContext: { location: { timezone: 'America/Chicago' } },
      requestMeta: {
        clientIp: '198.51.100.2',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/119.0 Safari/537.36',
      },
      hashSecret: 'unit-test-secret',
    });
    expect(out.location?.timezone).toBe('America/Chicago');
    expect(out.location?.source).toBe('browser_timezone');
  });

  it('uses unknown when no approximate geo and no timezone', () => {
    jest.spyOn(approxGeo, 'lookupApproxGeoFromIpSync').mockReturnValue(null);
    const out = buildConversationAnalyticsPersistence({
      requestMeta: {
        clientIp: '198.51.100.2',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/119.0 Safari/537.36',
      },
      hashSecret: 'unit-test-secret',
    });
    expect(out.location?.source).toBe('unknown');
    expect(out.location?.ipHash).toBeDefined();
    expect(out.location?.timezone).toBeUndefined();
  });

  it('does not persist raw client IP on location', () => {
    const rawIp = '203.0.113.99';
    jest.spyOn(approxGeo, 'lookupApproxGeoFromIpSync').mockReturnValue({
      countryCode: 'US',
      country: 'US',
    });
    const out = buildConversationAnalyticsPersistence({
      requestMeta: {
        clientIp: rawIp,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/119.0 Safari/537.36',
      },
      hashSecret: 'unit-test-secret',
    });
    expect(JSON.stringify(out.location)).not.toContain(rawIp);
    expect(out.location?.ipHash).toBeDefined();
  });
});
