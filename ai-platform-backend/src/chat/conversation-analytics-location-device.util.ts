import { createHash } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { getClientIpForRateLimit } from '../bots/embed-runtime-rate-limit.util';
import { isPublicRoutableIpv4ForApproxGeo, lookupApproxGeoFromIpSync } from './approx-geo-ip-lookup.util';
import type { AnalyticsContextPayload, AnalyticsRequestMeta } from './chat-engine.types';

export { isPublicRoutableIpv4ForApproxGeo, lookupApproxGeoFromIpSync } from './approx-geo-ip-lookup.util';

const MAX_COUNTRY = 100;
const MAX_COUNTRY_CODE = 10;
const MAX_REGION_CITY = 150;
const MAX_TIMEZONE = 100;
const MAX_LOC_SOURCE = 50;
const MAX_BROWSER_OS = 100;
const MAX_VER = 50;
const MAX_LANG = 50;
const MAX_HASH = 128;
const SCREEN_MIN = 100;
const SCREEN_MAX = 10000;

const LOCATION_SOURCES = new Set(['browser_timezone', 'ip_lookup', 'unknown']);

function trimSlice(s: string | undefined, max: number): string | undefined {
  const t = String(s ?? '').trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

/** HMAC would be nicer; SHA256(salt|ip) is sufficient for non-reversible analytics id. */
export function hashIpForAnalytics(ip: string, secret: string): string | undefined {
  const raw = String(ip ?? '').trim();
  if (!raw || raw === 'unknown') return undefined;
  const salt = String(secret ?? '').trim() || 'assistrio-analytics';
  const h = createHash('sha256');
  h.update(salt);
  h.update('|');
  h.update(raw);
  return h.digest('hex').slice(0, MAX_HASH);
}

/** IP + headers for analytics hashing / UA parsing (never persist raw IP). */
export function buildAnalyticsRequestMetaForChat(req: FastifyRequest): AnalyticsRequestMeta {
  const ua = req.headers['user-agent'];
  const al = req.headers['accept-language'];
  return {
    clientIp: getClientIpForRateLimit(req),
    userAgent: typeof ua === 'string' ? ua : undefined,
    acceptLanguage: typeof al === 'string' ? al : undefined,
  };
}

export type ParsedUaDevice = {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  browser: string;
  browserVersion?: string;
  os: string;
  osVersion?: string;
  userAgentHash?: string;
};

export function hashUserAgentForAnalytics(userAgent: string | undefined, secret: string): string | undefined {
  const raw = String(userAgent ?? '').trim();
  if (!raw) return undefined;
  const salt = String(secret ?? '').trim() || 'assistrio-analytics';
  const h = createHash('sha256');
  h.update(salt);
  h.update('|');
  h.update(raw);
  return h.digest('hex').slice(0, MAX_HASH);
}

/** Lightweight UA parsing — major browsers/OS and device class only. */
export function parseUserAgentForDeviceInfo(
  userAgent: string | undefined,
  _acceptLanguage: string | undefined,
  hashSecret: string,
): ParsedUaDevice {
  const ua = String(userAgent ?? '').trim();

  const out: ParsedUaDevice = {
    deviceType: 'unknown',
    browser: 'unknown',
    os: 'unknown',
  };
  if (!ua) {
    return out;
  }

  const lower = ua.toLowerCase();
  if (/bot|crawler|spider|facebookexternalhit|slackbot|googlebot|bingpreview/i.test(ua)) {
    out.deviceType = 'bot';
  } else if (/ipad|tablet|playbook|silk/i.test(lower) || (/android/i.test(lower) && !/mobile/i.test(lower))) {
    out.deviceType = 'tablet';
  } else if (/iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|mobile/i.test(lower)) {
    out.deviceType = 'mobile';
  } else {
    out.deviceType = 'desktop';
  }

  if (/edg(?:e|ios|a)?\//i.test(ua)) {
    out.browser = 'Edge';
    const m = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/i);
    if (m?.[1]) out.browserVersion = trimSlice(m[1], MAX_VER);
  } else if (/chrome|crios/i.test(ua) && !/chromium|edg/i.test(lower)) {
    out.browser = 'Chrome';
    const m = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/i);
    if (m?.[1]) out.browserVersion = trimSlice(m[1], MAX_VER);
  } else if (/firefox|fxios/i.test(lower)) {
    out.browser = 'Firefox';
    const m = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/i);
    if (m?.[1]) out.browserVersion = trimSlice(m[1], MAX_VER);
  } else if (/safari/i.test(ua) && !/chrome|crios|chromium/i.test(lower)) {
    out.browser = 'Safari';
    const m = ua.match(/Version\/([\d.]+)/i);
    if (m?.[1]) out.browserVersion = trimSlice(m[1], MAX_VER);
  }

  if (/windows nt/i.test(ua)) {
    out.os = 'Windows';
    const m = ua.match(/Windows NT ([\d.]+)/i);
    if (m?.[1]) out.osVersion = trimSlice(m[1], MAX_VER);
  } else if (/mac os x|macintosh/i.test(ua)) {
    out.os = 'macOS';
    const m = ua.match(/Mac OS X ([\d_]+)/i);
    if (m?.[1]) out.osVersion = trimSlice(m[1].replace(/_/g, '.'), MAX_VER);
  } else if (/iphone os|cpu os|cpu iphone os/i.test(ua)) {
    out.os = 'iOS';
    const m = ua.match(/OS ([\d_]+)/i);
    if (m?.[1]) out.osVersion = trimSlice(m[1].replace(/_/g, '.'), MAX_VER);
  } else if (/android/i.test(ua)) {
    out.os = 'Android';
    const m = ua.match(/Android ([\d.]+)/i);
    if (m?.[1]) out.osVersion = trimSlice(m[1], MAX_VER);
  } else if (/linux/i.test(lower)) {
    out.os = 'Linux';
  }

  out.userAgentHash = hashUserAgentForAnalytics(ua, hashSecret);
  return out;
}

function parseScreenDim(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  if (r < SCREEN_MIN || r > SCREEN_MAX) return undefined;
  return r;
}

function parseLat(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  if (n < -90 || n > 90) return undefined;
  return n;
}

function parseLon(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  if (n < -180 || n > 180) return undefined;
  return n;
}

export function sanitizeConversationLocationForPersistence(
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  const c = trimSlice(String(input.country ?? ''), MAX_COUNTRY);
  if (c) out.country = c;
  const cc = trimSlice(String(input.countryCode ?? ''), MAX_COUNTRY_CODE);
  if (cc) out.countryCode = cc.toUpperCase();
  const r = trimSlice(String(input.region ?? ''), MAX_REGION_CITY);
  if (r) out.region = r;
  const city = trimSlice(String(input.city ?? ''), MAX_REGION_CITY);
  if (city) out.city = city;
  const tz = trimSlice(String(input.timezone ?? ''), MAX_TIMEZONE);
  if (tz) out.timezone = tz;
  const iph = trimSlice(String(input.ipHash ?? ''), MAX_HASH);
  if (iph) out.ipHash = iph;
  const lat = parseLat(input.latitudeApprox);
  if (lat !== undefined) out.latitudeApprox = lat;
  const lon = parseLon(input.longitudeApprox);
  if (lon !== undefined) out.longitudeApprox = lon;
  const srcRaw = trimSlice(String(input.source ?? ''), MAX_LOC_SOURCE);
  if (srcRaw) {
    const low = srcRaw.toLowerCase();
    out.source = LOCATION_SOURCES.has(low) ? low : 'unknown';
  }
  return Object.keys(out).length ? out : undefined;
}

const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet', 'bot', 'unknown']);

export function sanitizeDeviceInfoForPersistence(
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  const dt = trimSlice(String(input.deviceType ?? ''), 20)?.toLowerCase();
  if (dt && DEVICE_TYPES.has(dt)) out.deviceType = dt;
  const br = trimSlice(String(input.browser ?? ''), MAX_BROWSER_OS);
  if (br && br.toLowerCase() !== 'unknown') out.browser = br;
  const bv = trimSlice(String(input.browserVersion ?? ''), MAX_VER);
  if (bv) out.browserVersion = bv;
  const os = trimSlice(String(input.os ?? ''), MAX_BROWSER_OS);
  if (os && os.toLowerCase() !== 'unknown') out.os = os;
  const ov = trimSlice(String(input.osVersion ?? ''), MAX_VER);
  if (ov) out.osVersion = ov;
  const sw = parseScreenDim(input.screenWidth);
  if (sw !== undefined) out.screenWidth = sw;
  const sh = parseScreenDim(input.screenHeight);
  if (sh !== undefined) out.screenHeight = sh;
  const lang = trimSlice(String(input.language ?? ''), MAX_LANG);
  if (lang) out.language = lang;
  const uah = trimSlice(String(input.userAgentHash ?? ''), MAX_HASH);
  if (uah) out.userAgentHash = uah;
  return Object.keys(out).length ? out : undefined;
}

function isEmptyish(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && !v.trim()) return true;
  if (typeof v === 'string' && v.trim().toLowerCase() === 'unknown') return true;
  return false;
}

export function mergeConversationLocationRecords(
  existing: Record<string, unknown> | undefined | null,
  incoming: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!incoming || Object.keys(incoming).length === 0) {
    return existing && Object.keys(existing).length > 0 ? { ...existing } : undefined;
  }
  const base = existing && Object.keys(existing).length > 0 ? { ...existing } : {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    const cur = base[k];
    if (isEmptyish(cur)) base[k] = v;
    else if (typeof cur === 'string' && cur.trim().toLowerCase() === 'unknown' && typeof v === 'string' && v.trim().toLowerCase() !== 'unknown') {
      base[k] = v;
    }
  }
  return Object.keys(base).length ? base : undefined;
}

export function mergeConversationDeviceInfoRecords(
  existing: Record<string, unknown> | undefined | null,
  incoming: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  return mergeConversationLocationRecords(existing, incoming);
}

/** Non-timezone coordinates/place fields — if any are present, prefer `ip_lookup` over `browser_timezone`. */
function hasApproxGeoStructuralFields(loc: Record<string, unknown>): boolean {
  const strMeaningful = (v: unknown): boolean =>
    typeof v === 'string' && v.trim().length > 0 && v.trim().toLowerCase() !== 'unknown';
  if (strMeaningful(loc.country) || strMeaningful(loc.countryCode) || strMeaningful(loc.region) || strMeaningful(loc.city)) {
    return true;
  }
  const lat = loc.latitudeApprox;
  const lon = loc.longitudeApprox;
  if (typeof lat === 'number' && Number.isFinite(lat)) return true;
  if (typeof lon === 'number' && Number.isFinite(lon)) return true;
  return false;
}

function finalizeLocationSource(loc: Record<string, unknown>): void {
  if (hasApproxGeoStructuralFields(loc)) {
    loc.source = 'ip_lookup';
    return;
  }

  const tz = typeof loc.timezone === 'string' && loc.timezone.trim();
  if (tz) {
    loc.source = 'browser_timezone';
    return;
  }

  if (loc.ipHash && !LOCATION_SOURCES.has(String(loc.source ?? '').toLowerCase())) {
    loc.source = 'unknown';
  }
  if (!loc.source) loc.source = 'unknown';
}

export function parseAnalyticsContextFromUnknown(raw: unknown): AnalyticsContextPayload | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const locRaw = o.location;
  const devRaw = o.deviceInfo;
  const out: AnalyticsContextPayload = {};
  if (locRaw && typeof locRaw === 'object' && !Array.isArray(locRaw)) {
    const L = locRaw as Record<string, unknown>;
    out.location = {
      ...(typeof L.timezone === 'string' ? { timezone: L.timezone } : {}),
      ...(typeof L.source === 'string' ? { source: L.source } : {}),
      ...(typeof L.country === 'string' ? { country: L.country } : {}),
      ...(typeof L.countryCode === 'string' ? { countryCode: L.countryCode } : {}),
      ...(typeof L.region === 'string' ? { region: L.region } : {}),
      ...(typeof L.city === 'string' ? { city: L.city } : {}),
      ...(typeof L.latitudeApprox === 'number' ? { latitudeApprox: L.latitudeApprox } : {}),
      ...(typeof L.longitudeApprox === 'number' ? { longitudeApprox: L.longitudeApprox } : {}),
    };
    if (Object.keys(out.location ?? {}).length === 0) delete out.location;
  }
  if (devRaw && typeof devRaw === 'object' && !Array.isArray(devRaw)) {
    const D = devRaw as Record<string, unknown>;
    out.deviceInfo = {
      ...(typeof D.deviceType === 'string' ? { deviceType: D.deviceType } : {}),
      ...(typeof D.browser === 'string' ? { browser: D.browser } : {}),
      ...(typeof D.browserVersion === 'string' ? { browserVersion: D.browserVersion } : {}),
      ...(typeof D.os === 'string' ? { os: D.os } : {}),
      ...(typeof D.osVersion === 'string' ? { osVersion: D.osVersion } : {}),
      ...(typeof D.screenWidth === 'number' ? { screenWidth: D.screenWidth } : {}),
      ...(typeof D.screenHeight === 'number' ? { screenHeight: D.screenHeight } : {}),
      ...(typeof D.language === 'string' ? { language: D.language } : {}),
      ...(typeof D.userAgentHash === 'string' ? { userAgentHash: D.userAgentHash } : {}),
    };
    if (Object.keys(out.deviceInfo ?? {}).length === 0) delete out.deviceInfo;
  }
  return Object.keys(out).length ? out : undefined;
}

function contextLocationToRecord(loc: AnalyticsContextPayload['location']): Record<string, unknown> | undefined {
  if (!loc) return undefined;
  return sanitizeConversationLocationForPersistence(loc as unknown as Record<string, unknown>);
}

function contextDeviceToRecord(dev: AnalyticsContextPayload['deviceInfo']): Record<string, unknown> | undefined {
  if (!dev) return undefined;
  return sanitizeDeviceInfoForPersistence(dev as unknown as Record<string, unknown>);
}

/**
 * Merge client analyticsContext + server-derived headers/IP into sanitized persistence shapes.
 */
export function buildConversationAnalyticsPersistence(input: {
  clientContext?: AnalyticsContextPayload | null;
  requestMeta?: AnalyticsRequestMeta | null;
  hashSecret: string;
}): { location?: Record<string, unknown>; deviceInfo?: Record<string, unknown> } {
  const secret = String(input.hashSecret ?? '').trim() || 'assistrio-analytics';
  const clientLoc = contextLocationToRecord(input.clientContext?.location);
  const clientDev = contextDeviceToRecord(input.clientContext?.deviceInfo);

  const ip = String(input.requestMeta?.clientIp ?? '').trim();
  const ipHash = hashIpForAnalytics(ip, secret);
  const geoFromIp = lookupApproxGeoFromIpSync(ip);
  const hasGeo = geoFromIp && Object.keys(geoFromIp).length > 0;
  const serverLocSan = sanitizeConversationLocationForPersistence(
    ipHash || hasGeo
      ? {
          ...(ipHash ? { ipHash } : {}),
          ...(geoFromIp ?? {}),
          source: hasGeo ? 'ip_lookup' : 'unknown',
        }
      : undefined,
  );

  const uaParsed = parseUserAgentForDeviceInfo(input.requestMeta?.userAgent, input.requestMeta?.acceptLanguage, secret);
  const serverDevSan = sanitizeDeviceInfoForPersistence({
    deviceType: uaParsed.deviceType,
    browser: uaParsed.browser,
    browserVersion: uaParsed.browserVersion,
    os: uaParsed.os,
    osVersion: uaParsed.osVersion,
    userAgentHash: uaParsed.userAgentHash,
    ...(typeof input.requestMeta?.acceptLanguage === 'string' && input.requestMeta.acceptLanguage.trim()
      ? {
          language: trimSlice(input.requestMeta.acceptLanguage.split(',')[0]?.split(';')[0]?.trim(), MAX_LANG),
        }
      : {}),
  } as Record<string, unknown>);

  // Client/browser fields win over server IP-derived geo when both are present (e.g. timezone).
  let location = mergeConversationLocationRecords(clientLoc, serverLocSan);
  if (location) finalizeLocationSource(location);

  let deviceInfo = mergeConversationDeviceInfoRecords(serverDevSan, clientDev);
  const clientLang =
    clientDev && typeof (clientDev as { language?: string }).language === 'string'
      ? trimSlice((clientDev as { language?: string }).language, MAX_LANG)
      : undefined;
  if (deviceInfo && clientLang) {
    deviceInfo.language = clientLang;
  }

  return {
    ...(location && Object.keys(location).length ? { location } : {}),
    ...(deviceInfo && Object.keys(deviceInfo).length ? { deviceInfo } : {}),
  };
}
