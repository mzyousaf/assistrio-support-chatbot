import { isPublicRoutableIpv4ForApproxGeo, lookupApproxGeoFromIpSync } from './approx-geo-ip-lookup.util';

describe('isPublicRoutableIpv4ForApproxGeo', () => {
  it('rejects loopback and private ranges', () => {
    expect(isPublicRoutableIpv4ForApproxGeo('127.0.0.1')).toBe(false);
    expect(isPublicRoutableIpv4ForApproxGeo('10.0.0.1')).toBe(false);
    expect(isPublicRoutableIpv4ForApproxGeo('192.168.1.1')).toBe(false);
    expect(isPublicRoutableIpv4ForApproxGeo('172.20.1.1')).toBe(false);
    expect(isPublicRoutableIpv4ForApproxGeo('172.15.255.1')).toBe(true);
    expect(isPublicRoutableIpv4ForApproxGeo('172.32.0.1')).toBe(true);
  });

  it('rejects non-ipv4', () => {
    expect(isPublicRoutableIpv4ForApproxGeo('::1')).toBe(false);
    expect(isPublicRoutableIpv4ForApproxGeo('example.com')).toBe(false);
  });
});

describe('lookupApproxGeoFromIpSync', () => {
  it('returns null for private IPs without echoing input', () => {
    expect(lookupApproxGeoFromIpSync('192.168.4.4')).toBeNull();
  });

  it('returns null when package absent or for documentation IPs (typical)', () => {
    expect(lookupApproxGeoFromIpSync('198.51.100.2')).toBeNull();
  });
});
