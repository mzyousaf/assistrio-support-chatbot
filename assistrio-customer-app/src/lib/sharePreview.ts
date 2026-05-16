import { getCustomerAppPublicOrigin } from './embedOrigin';

/** Allowed `expiresInHours` values for POST/PATCH share-link (matches backend). */
export const SHARE_PREVIEW_EXPIRES_HOURS_OPTIONS = [
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
  { hours: 96, label: '4 days' },
  { hours: 120, label: '5 days' },
  { hours: 144, label: '6 days' },
  { hours: 168, label: '7 days' },
] as const;

export const SHARE_PREVIEW_DEFAULT_EXPIRES_HOURS = 24;

export type BuildSharePreviewUrlInput = {
  slug: string;
  previewToken: string | null | undefined;
  appOrigin?: string;
};

/**
 * Full share preview URL. Returns `null` if slug or token is missing (no broken links).
 */
export function buildSharePreviewUrl(opts: BuildSharePreviewUrlInput): string | null {
  const slug = String(opts.slug ?? '').trim().toLowerCase();
  if (!slug) return null;
  const t = String(opts.previewToken ?? '').trim();
  if (!t) return null;
  const base = (opts.appOrigin ?? getCustomerAppPublicOrigin()).replace(/\/$/, '');
  const path = `${base}/share/${encodeURIComponent(slug)}`;
  return `${path}${path.includes('?') ? '&' : '?'}shareToken=${encodeURIComponent(t)}`;
}

/** @deprecated Prefer {@link buildSharePreviewUrl} with token; slug-only URLs are not valid for share preview. */
export function buildSharePreviewUrlWithToken(slug: string, previewToken: string): string | null {
  return buildSharePreviewUrl({ slug, previewToken });
}

/** Merge token into a full share URL returned by the API (path may already be absolute). */
export function appendSharePreviewToken(shareUrlFromApi: string, previewToken?: string | null): string | null {
  const u = shareUrlFromApi.trim();
  const t = previewToken?.trim();
  if (!u || !t) return u || null;
  return `${u}${u.includes('?') ? '&' : '?'}shareToken=${encodeURIComponent(t)}`;
}

export type SharePreviewLifeSpanState = 'active' | 'expired' | 'missing';

export type SharePreviewLifeSpanInfo = {
  state: SharePreviewLifeSpanState;
  /**
   * Single primary line for UI: relative “time left” while active, or absolute “Expired on …” when past.
   */
  label: string;
  /**
   * While active: exact end moment for tooltips (not shown as a second line in the modal).
   */
  detailTooltip?: string;
};

function formatExpiryEndTooltip(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Relative + exact expiry copy for Share Preview (secure links always have an expiry).
 */
export function formatSharePreviewLifeSpan(expiresAt?: string | null): SharePreviewLifeSpanInfo {
  if (expiresAt == null || String(expiresAt).trim() === '') {
    return { state: 'missing', label: 'Expiry required' };
  }
  const d = new Date(expiresAt);
  if (!Number.isFinite(d.getTime())) {
    return { state: 'missing', label: 'Expiry required' };
  }
  const detailTooltip = formatExpiryEndTooltip(d);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) {
    const when = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
    return { state: 'expired', label: `Expired on ${when}` };
  }
  const hoursTotal = diffMs / 3_600_000;
  const minutes = Math.floor(diffMs / 60_000);
  if (hoursTotal < 1) {
    if (minutes >= 1) {
      return {
        state: 'active',
        label: `${minutes} minute${minutes === 1 ? '' : 's'} left`,
        detailTooltip,
      };
    }
    return { state: 'active', label: 'Less than a minute left', detailTooltip };
  }
  if (hoursTotal < 24) {
    const totalMinutes = Math.floor(diffMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const hourPart = `${hours} hour${hours === 1 ? '' : 's'}`;
    if (mins === 0) {
      return { state: 'active', label: `${hourPart} left`, detailTooltip };
    }
    const minPart = `${mins} minute${mins === 1 ? '' : 's'}`;
    return {
      state: 'active',
      label: `${hourPart} and ${minPart} left`,
      detailTooltip,
    };
  }
  const days = Math.floor(diffMs / 86_400_000);
  return {
    state: 'active',
    label: `${days} day${days === 1 ? '' : 's'} left`,
    detailTooltip,
  };
}
