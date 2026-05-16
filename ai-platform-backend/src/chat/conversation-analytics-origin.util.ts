import type { ConversationStartedFrom } from '../models/conversation.schema';
import type { ConversationOriginPayload } from './chat-engine.types';

const MAX_SOURCE_MODE_EMBED = 100;
const MAX_WEBSITE_ORIGIN = 300;
const MAX_URL = 1000;
const MAX_SHARE_SLUG = 128;
const MAX_USER_AGENT_HASH = 64;

/** Strip query/hash from http(s) URLs before persistence (analytics also normalizes for display). */
export function stripUrlQueryAndHashForStorage(raw?: string): string | undefined {
  const t = raw?.trim() ?? '';
  if (!t) return undefined;
  try {
    const href = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return t.split('?')[0]?.split('#')[0]?.trim().slice(0, MAX_URL) || undefined;
    }
    u.search = '';
    u.hash = '';
    let pathname = u.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    u.pathname = pathname;
    return u.href.slice(0, MAX_URL);
  } catch {
    const stripped = t.split('?')[0]?.split('#')[0]?.trim();
    return stripped ? stripped.slice(0, MAX_URL) : undefined;
  }
}

/** Resolve a pathname or full URL into an absolute page URL when website origin is known. */
export function resolvePageUrlFromSourcePage(
  sourcePage: string | undefined,
  websiteOrigin: string | undefined,
): string | undefined {
  const sp = sourcePage?.trim() ?? '';
  if (!sp) return undefined;
  if (/^https?:\/\//i.test(sp)) return stripUrlQueryAndHashForStorage(sp);
  const origin = websiteOrigin?.trim();
  if (!origin) return stripUrlQueryAndHashForStorage(sp);
  try {
    const path = sp.startsWith('/') ? sp : `/${sp}`;
    return stripUrlQueryAndHashForStorage(new URL(path, origin).href);
  } catch {
    return stripUrlQueryAndHashForStorage(sp);
  }
}

export const STORED_CONVERSATION_ORIGIN_SOURCES = new Set([
  'script_embed',
  'iframe_embed',
  'shared_link',
  'widget_preview',
  'playground_preview',
  'shared_preview',
  'unknown',
]);

/** Pick string fields from an unknown nested object (client JSON). */
export function parseConversationOriginFromUnknown(raw: unknown): ConversationOriginPayload | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const s = (k: string): string | undefined => {
    const v = o[k];
    return typeof v === 'string' ? v : undefined;
  };
  const out: ConversationOriginPayload = {};
  const sourceRaw = s('source')?.trim();
  const modeRaw = s('mode')?.trim().toLowerCase();
  const surface = s('surface')?.trim();
  const pageUrl = s('pageUrl')?.trim();
  const referrer = s('referrer')?.trim();
  const origin = s('origin')?.trim();
  const parentOrigin = s('parentOrigin')?.trim();
  const shareSlug = s('shareSlug')?.trim();
  const embedType = s('embedType')?.trim();
  const websiteOrigin = s('websiteOrigin')?.trim();
  const iframeUrl = s('iframeUrl')?.trim();
  const sharedUrl = s('sharedUrl')?.trim();
  const userAgentHash = s('userAgentHash')?.trim();
  if (sourceRaw) {
    const low = sourceRaw.toLowerCase();
    if (STORED_CONVERSATION_ORIGIN_SOURCES.has(low)) {
      out.source = low as ConversationOriginPayload['source'];
    }
  }
  if (modeRaw === 'preview' || modeRaw === 'runtime') out.mode = modeRaw;
  if (surface) out.surface = surface;
  if (pageUrl) out.pageUrl = pageUrl;
  if (referrer) out.referrer = referrer;
  if (origin) out.origin = origin;
  if (parentOrigin) out.parentOrigin = parentOrigin;
  if (shareSlug) out.shareSlug = shareSlug;
  if (embedType) out.embedType = embedType;
  if (websiteOrigin) out.websiteOrigin = websiteOrigin;
  if (iframeUrl) out.iframeUrl = iframeUrl;
  if (sharedUrl) out.sharedUrl = sharedUrl;
  if (userAgentHash) out.userAgentHash = userAgentHash;
  return Object.keys(out).length ? out : undefined;
}

/**
 * Maps legacy sessionSource + optional origin into product startedFrom.
 * sessionSource values are unchanged in the DB; this only drives `conversation.startedFrom`.
 */
export function resolveConversationStartedFrom(input: {
  sessionSource?: string;
  conversationOrigin?: ConversationOriginPayload | null;
}): ConversationStartedFrom {
  const ss = String(input.sessionSource ?? '').trim();
  const o = input.conversationOrigin;
  const src = String(o?.source ?? '').trim();
  const embed = String(o?.embedType ?? '').trim().toLowerCase();

  if (ss === 'widget_preview' || src === 'playground_preview') return 'playground_preview';
  if (ss === 'shared_preview' || ss === 'shared_link' || src === 'shared_preview' || embed === 'shared_preview') {
    return 'shared_preview';
  }
  if (ss === 'iframe_embed') return 'runtime_iframe';
  if (ss === 'runtime') return 'runtime_widget';
  if (!ss) return 'unknown';
  return 'unknown';
}

export function sanitizeConversationOriginForPersistence(
  input?: ConversationOriginPayload | null,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  const t = (v: string | undefined, max: number) => {
    const x = v?.trim() ?? '';
    return x ? x.slice(0, max) : '';
  };

  const rawSource = t(input.source, MAX_SOURCE_MODE_EMBED);
  if (rawSource) {
    const low = rawSource.toLowerCase();
    if (STORED_CONVERSATION_ORIGIN_SOURCES.has(low)) out.source = low;
  }
  if (input.mode === 'preview' || input.mode === 'runtime') out.mode = input.mode;

  const surface = t(input.surface, MAX_SOURCE_MODE_EMBED);
  if (surface) out.surface = surface;
  const embedType = t(input.embedType, MAX_SOURCE_MODE_EMBED);
  if (embedType) out.embedType = embedType;

  const pageUrl = stripUrlQueryAndHashForStorage(t(input.pageUrl, MAX_URL));
  if (pageUrl) out.pageUrl = pageUrl;
  const referrer = stripUrlQueryAndHashForStorage(t(input.referrer, MAX_URL));
  if (referrer) out.referrer = referrer;
  const origin = t(input.origin, MAX_WEBSITE_ORIGIN);
  if (origin) out.origin = origin;
  const websiteOrigin = t(input.websiteOrigin, MAX_WEBSITE_ORIGIN);
  if (websiteOrigin) out.websiteOrigin = websiteOrigin;
  const parentOrigin = t(input.parentOrigin, MAX_WEBSITE_ORIGIN);
  if (parentOrigin) out.parentOrigin = parentOrigin;
  const iframeUrl = stripUrlQueryAndHashForStorage(t(input.iframeUrl, MAX_URL));
  if (iframeUrl) out.iframeUrl = iframeUrl;
  const sharedUrl = stripUrlQueryAndHashForStorage(t(input.sharedUrl, MAX_URL));
  if (sharedUrl) out.sharedUrl = sharedUrl;

  const shareSlug = t(input.shareSlug, MAX_SHARE_SLUG);
  if (shareSlug) out.shareSlug = shareSlug.toLowerCase();

  const uah = t(input.userAgentHash, MAX_USER_AGENT_HASH);
  if (uah) out.userAgentHash = uah;

  return Object.keys(out).length ? out : undefined;
}

/** Sanitize and merge multiple origin payloads (later parts fill missing keys only). */
export function mergeSanitizedConversationOrigins(
  ...parts: Array<ConversationOriginPayload | null | undefined>
): Record<string, unknown> | undefined {
  let acc: Record<string, unknown> | undefined;
  for (const part of parts) {
    const sanitized = sanitizeConversationOriginForPersistence(part);
    acc = mergeConversationOriginRecords(acc, sanitized);
  }
  return acc;
}

export function mergeConversationOriginRecords(
  existing: Record<string, unknown> | undefined | null,
  incoming: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!incoming || Object.keys(incoming).length === 0) {
    return existing && Object.keys(existing).length > 0 ? { ...existing } : undefined;
  }
  if (!existing || Object.keys(existing).length === 0) return { ...incoming };
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    out[k] = v;
  }
  return out;
}
