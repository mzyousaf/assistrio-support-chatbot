import type { CustomerConversationMessageSource } from '@/api/types';
import { utf8ByteLength } from '@/lib/knowledgeContentUtf8Limits';

const PREVIEW_MAX = 480;

export function formatSourcePreviewForDisplay(text: string | undefined): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\r\n/g, '\n').trim();
}

/** Treat blank or literal “Untitled” as missing so URL-derived labels can be used. */
function usableTitleFragment(raw: string | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (/^untitled$/i.test(t)) return null;
  return t;
}

export function sourceDisplayTitle(s: CustomerConversationMessageSource): string {
  const candidates = [s.sourceTitle, s.title, s.name, s.docTitle];
  for (const c of candidates) {
    const u = usableTitleFragment(c);
    if (u) return u;
  }
  const urlName = displayNameFromHttpUrl(s.sourceUrl);
  if (urlName) return urlName;
  return '';
}

export function clampSourcePreview(text: string | undefined, max = PREVIEW_MAX): string | null {
  const formatted = formatSourcePreviewForDisplay(text);
  if (!formatted) return null;
  if (utf8ByteLength(formatted) <= max) return formatted;
  let lo = 0;
  let hi = formatted.length;
  const enc = new TextEncoder();
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (enc.encode(formatted.slice(0, mid)).length <= max) lo = mid;
    else hi = mid - 1;
  }
  const slice = formatted.slice(0, lo).trimEnd();
  return slice ? `${slice}…` : '…';
}

export function displayNameFromHttpUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
    return `${host}${path}`.slice(0, 120) || host || null;
  } catch {
    return t.slice(0, 120);
  }
}

export function safeSourceHttpUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}
