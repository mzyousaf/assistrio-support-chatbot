import { getAdminApiOrigin } from './client';
import type { PlatformBotType } from './types';

export type PublicPlatformBotItem = {
  id: string;
  name: string;
  description?: string | null;
  platformBotType: PlatformBotType;
  avatarUrl?: string | null;
  status: 'published';
  visibility?: 'public';
  accessKey?: string;
  publicSlug?: string | null;
  greeting?: string | null;
  suggestedQuestions?: string[];
  updatedAt?: string | null;
};

export type PublicPlatformBotsListResponse = {
  ok: true;
  bots: PublicPlatformBotItem[];
};

export type PublicPlatformBotDetailResponse = {
  ok: true;
  bot: PublicPlatformBotItem;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function getPublicPlatformBots(params?: { type?: PlatformBotType }) {
  const base = getAdminApiOrigin();
  const q = new URLSearchParams();
  if (params?.type) q.set('type', params.type);
  const qs = q.toString();
  const res = await fetch(`${base}/api/public/platform-bots${qs ? `?${qs}` : ''}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(res);
  if (!res.ok) {
    const err =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : res.statusText || 'Request failed';
    return { ok: false as const, status: res.status, error: err, body };
  }
  return { ok: true as const, status: res.status, data: body as PublicPlatformBotsListResponse };
}

export async function getPublicPlatformBot(idOrSlug: string) {
  const base = getAdminApiOrigin();
  const res = await fetch(`${base}/api/public/platform-bots/${encodeURIComponent(idOrSlug)}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(res);
  if (!res.ok) {
    const err =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : res.statusText || 'Request failed';
    return { ok: false as const, status: res.status, error: err, body };
  }
  return { ok: true as const, status: res.status, data: body as PublicPlatformBotDetailResponse };
}
