import * as geoip from 'geoip-lite';

/**
 * Best-effort approximate geo from client IP for conversation analytics.
 *
 * - Uses the IP string only transiently; callers must persist `ipHash`, never raw IP.
 * - Uses `geoip-lite` (free Apache-2.0, offline GeoLite-style data bundled with the package —
 *   no paid APIs or network calls on the chat path).
 * - IPv4 public addresses only in this path; returns `null` for private/invalid IPs.
 *
 * Refresh the bundled DB occasionally via `geoip-lite`'s `updatedb` script (see package README);
 * stale data only affects accuracy, not app correctness.
 */

function trimIp(ip: string | undefined | null): string {
  const t = String(ip ?? '').trim();
  if (!t || t.toLowerCase() === 'unknown') return '';
  return t;
}

/** IPv4 only for geoip-lite; extend later if a v6-capable provider is added. */
export function isPublicRoutableIpv4ForApproxGeo(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return false;
  const o = m.slice(1, 5).map((x) => Number(x));
  if (o.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = o;
  if (a === 0 || a === 127 || a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64.0.0/10
  if (a >= 224) return false; // multicast / reserved
  return true;
}

export type ApproxGeoFromIpFields = {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  latitudeApprox?: number;
  longitudeApprox?: number;
};

type GeoLiteLookup = {
  country?: string;
  region?: string;
  city?: string;
  ll?: [number, number];
  timezone?: string;
} | null;

/** Synchronous offline lookup via geoip-lite. Never throws. */
export function lookupApproxGeoFromIpSync(ip: string | undefined | null): ApproxGeoFromIpFields | null {
  const raw = trimIp(ip);
  if (!raw || !isPublicRoutableIpv4ForApproxGeo(raw)) return null;

  try {
    const r = geoip.lookup(raw) as GeoLiteLookup;
    if (!r || typeof r !== 'object') return null;

    const countryCode = typeof r.country === 'string' && /^[A-Za-z]{2}$/.test(r.country) ? r.country.toUpperCase() : undefined;
    const region = typeof r.region === 'string' && r.region.trim() ? r.region.trim() : undefined;
    const city = typeof r.city === 'string' && r.city.trim() ? r.city.trim() : undefined;
    const timezone = typeof r.timezone === 'string' && r.timezone.trim() ? r.timezone.trim() : undefined;

    const out: ApproxGeoFromIpFields = {};
    if (countryCode) {
      out.countryCode = countryCode;
      out.country = countryCode;
    }
    if (region) out.region = region;
    if (city) out.city = city;
    if (timezone) out.timezone = timezone;

    if (Array.isArray(r.ll) && r.ll.length >= 2) {
      const lat = Number(r.ll[0]);
      const lon = Number(r.ll[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        out.latitudeApprox = Math.round(lat * 100) / 100;
        out.longitudeApprox = Math.round(lon * 100) / 100;
      }
    }

    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
