/**
 * Single place for “latest avatar source wins” for trial onboarding drafts.
 * Used by draft API mapping and bot creation.
 */

export type TrialAvatarByUploadShape = {
  url: string;
  assetKey?: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  updatedAt: Date | string;
};

export type TrialAvatarByUserURLShape = {
  url: string;
  updatedAt: Date | string;
};

function toTime(v: Date | string | undefined): number {
  if (v == null) return 0;
  if (v instanceof Date) return v.getTime();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function trimUrl(v: unknown, max = 2000): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

/** Normalize lean/mongo subdocs to shapes with times for comparison. */
export function parseAvatarByUploadFromDoc(raw: unknown): TrialAvatarByUploadShape | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const url = trimUrl(o.url);
  if (!url) return undefined;
  let updatedAt: Date;
  if (o.updatedAt instanceof Date) updatedAt = o.updatedAt;
  else if (typeof o.updatedAt === 'string' && o.updatedAt.trim()) {
    const d = new Date(o.updatedAt);
    updatedAt = Number.isNaN(d.getTime()) ? new Date() : d;
  } else if (o.uploadedAt instanceof Date) updatedAt = o.uploadedAt;
  else if (typeof o.uploadedAt === 'string' && o.uploadedAt.trim()) {
    const d = new Date(o.uploadedAt);
    updatedAt = Number.isNaN(d.getTime()) ? new Date() : d;
  } else {
    updatedAt = new Date();
  }
  return {
    url,
    ...(typeof o.assetKey === 'string' && o.assetKey.trim() ? { assetKey: o.assetKey.trim().slice(0, 1024) } : {}),
    ...(typeof o.originalFilename === 'string' ? { originalFilename: o.originalFilename.slice(0, 500) } : {}),
    ...(typeof o.mimeType === 'string' ? { mimeType: o.mimeType.slice(0, 200) } : {}),
    ...(typeof o.sizeBytes === 'number' && Number.isFinite(o.sizeBytes) && o.sizeBytes >= 0
      ? { sizeBytes: Math.floor(o.sizeBytes) }
      : {}),
    updatedAt,
  };
}

export function parseAvatarByUserURLFromDoc(raw: unknown): TrialAvatarByUserURLShape | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const url = trimUrl(o.url);
  if (!url) return undefined;
  let updatedAt: Date;
  if (o.updatedAt instanceof Date) updatedAt = o.updatedAt;
  else if (typeof o.updatedAt === 'string' && o.updatedAt.trim()) {
    const d = new Date(o.updatedAt);
    updatedAt = Number.isNaN(d.getTime()) ? new Date() : d;
  } else {
    updatedAt = new Date();
  }
  return { url, updatedAt };
}

/**
 * Prefer new structure; fall back to legacy flat `avatarUrl` only when no structured sources exist.
 */
export function resolveFinalAvatarUrlFromDraftRow(doc: Record<string, unknown>): string {
  const upload = parseAvatarByUploadFromDoc(doc.avatarByUpload);
  const userUrl = parseAvatarByUserURLFromDoc(doc.avatarByUserURL);
  const legacy = trimUrl(doc.avatarUrl);

  const tUp = upload ? toTime(upload.updatedAt) : 0;
  const tUser = userUrl ? toTime(userUrl.updatedAt) : 0;

  if (upload && !userUrl) return upload.url;
  if (!upload && userUrl) return userUrl.url;
  if (upload && userUrl) {
    if (tUp > tUser) return upload.url;
    if (tUser > tUp) return userUrl.url;
    return upload.url;
  }

  if (legacy) return legacy;
  return '';
}

function iso(d: Date): string {
  return d.toISOString();
}

/** Infer legacy-only `avatarUrl` into structured fields for API (no DB write). */
export function inferStructuredAvatarsFromLegacyDoc(doc: Record<string, unknown>): {
  avatarByUpload?: TrialAvatarByUploadShape;
  avatarByUserURL?: TrialAvatarByUserURLShape;
} {
  let upload = parseAvatarByUploadFromDoc(doc.avatarByUpload);
  let userUrl = parseAvatarByUserURLFromDoc(doc.avatarByUserURL);
  const legacy = trimUrl(doc.avatarUrl);
  if (upload || userUrl || !legacy) {
    return {
      ...(upload ? { avatarByUpload: upload } : {}),
      ...(userUrl ? { avatarByUserURL: userUrl } : {}),
    };
  }
  const assets = doc.uploadedAssets;
  const avatarAsset =
    Array.isArray(assets) &&
    (assets as Record<string, unknown>[]).find((a) => a && typeof a === 'object' && a.kind === 'avatar');
  const assetUrl = avatarAsset && typeof avatarAsset === 'object' ? trimUrl((avatarAsset as Record<string, unknown>).url) : '';
  const updated =
    doc.updatedAt instanceof Date ? doc.updatedAt : new Date(String(doc.updatedAt ?? Date.now()));

  if (assetUrl && assetUrl === legacy) {
    let uploadedAt = updated;
    const ua = (avatarAsset as Record<string, unknown>).uploadedAt;
    if (ua instanceof Date) uploadedAt = ua;
    else if (typeof ua === 'string' && ua.trim()) {
      const d = new Date(ua);
      if (!Number.isNaN(d.getTime())) uploadedAt = d;
    }
    upload = {
      url: legacy,
      ...(typeof (avatarAsset as Record<string, unknown>).assetKey === 'string'
        ? { assetKey: String((avatarAsset as Record<string, unknown>).assetKey).slice(0, 1024) }
        : {}),
      updatedAt: uploadedAt,
    };
    return { avatarByUpload: upload };
  }

  if (/^https?:\/\//i.test(legacy)) {
    userUrl = { url: legacy, updatedAt: updated };
    return { avatarByUserURL: userUrl };
  }

  upload = { url: legacy, updatedAt: updated };
  return { avatarByUpload: upload };
}

export function trialAvatarByUploadToApi(a: TrialAvatarByUploadShape): {
  url: string;
  assetKey?: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  updatedAt: string;
} {
  const u = a.updatedAt instanceof Date ? a.updatedAt : new Date(String(a.updatedAt));
  return {
    url: trimUrl(a.url),
    ...(a.assetKey ? { assetKey: String(a.assetKey).trim().slice(0, 1024) } : {}),
    ...(a.originalFilename ? { originalFilename: String(a.originalFilename).slice(0, 500) } : {}),
    ...(a.mimeType ? { mimeType: String(a.mimeType).slice(0, 200) } : {}),
    ...(typeof a.sizeBytes === 'number' && Number.isFinite(a.sizeBytes) ? { sizeBytes: Math.floor(a.sizeBytes) } : {}),
    updatedAt: Number.isNaN(u.getTime()) ? new Date().toISOString() : iso(u),
  };
}

export function trialAvatarByUserURLToApi(a: TrialAvatarByUserURLShape): { url: string; updatedAt: string } {
  const u = a.updatedAt instanceof Date ? a.updatedAt : new Date(String(a.updatedAt));
  return {
    url: trimUrl(a.url),
    updatedAt: Number.isNaN(u.getTime()) ? new Date().toISOString() : iso(u),
  };
}

/** Full profile avatar fields for landing API: structured sources + resolved `avatarUrl`. */
export function buildTrialProfileAvatarApiPayload(doc: Record<string, unknown>): {
  avatarUrl: string;
  avatarByUpload?: ReturnType<typeof trialAvatarByUploadToApi>;
  avatarByUserURL?: ReturnType<typeof trialAvatarByUserURLToApi>;
} {
  const inferred = inferStructuredAvatarsFromLegacyDoc(doc);
  const upload = inferred.avatarByUpload ?? parseAvatarByUploadFromDoc(doc.avatarByUpload);
  const userUrl = inferred.avatarByUserURL ?? parseAvatarByUserURLFromDoc(doc.avatarByUserURL);
  const mergedDoc: Record<string, unknown> = {
    ...doc,
    ...(upload ? { avatarByUpload: upload } : {}),
    ...(userUrl ? { avatarByUserURL: userUrl } : {}),
  };
  const resolved = resolveFinalAvatarUrlFromDraftRow(mergedDoc);
  return {
    avatarUrl: resolved,
    ...(upload ? { avatarByUpload: trialAvatarByUploadToApi(upload) } : {}),
    ...(userUrl ? { avatarByUserURL: trialAvatarByUserURLToApi(userUrl) } : {}),
  };
}
