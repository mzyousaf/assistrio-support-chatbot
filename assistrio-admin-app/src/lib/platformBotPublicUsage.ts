import type { AdminBotAllowedOrigin, AdminPlatformBotDetail } from '@/api/types';
import { getAdminApiOrigin } from '@/api/client';

export type PublicReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export function activeAllowedOrigins(origins: AdminBotAllowedOrigin[] | undefined): string[] {
  return (origins ?? [])
    .filter((o) => o.isActive !== false && o.origin?.trim())
    .map((o) => o.origin!.trim());
}

export function buildPlatformBotPublicApiUrl(bot: Pick<AdminPlatformBotDetail, '_id' | 'slug' | 'platformBotType'>): string {
  const base = getAdminApiOrigin();
  const segment = encodeURIComponent(bot.slug?.trim() || bot._id);
  return `${base}/api/public/platform-bots/${segment}`;
}

export function buildPlatformBotPublicListApiUrl(
  platformBotType?: AdminPlatformBotDetail['platformBotType'],
): string {
  const base = getAdminApiOrigin();
  if (platformBotType) {
    return `${base}/api/public/platform-bots?type=${encodeURIComponent(platformBotType)}`;
  }
  return `${base}/api/public/platform-bots`;
}

export function evaluatePlatformBotPublicReadiness(bot: AdminPlatformBotDetail): {
  checks: PublicReadinessCheck[];
  isReady: boolean;
} {
  const origins = activeAllowedOrigins(bot.allowedOrigins);
  const checks: PublicReadinessCheck[] = [
    {
      id: 'published',
      label: 'Status is published',
      ok: bot.status === 'published',
    },
    {
      id: 'visibility',
      label: 'Visibility is public',
      ok: bot.visibility === 'public',
    },
    {
      id: 'name',
      label: 'Name is set',
      ok: Boolean(bot.name?.trim()),
    },
    {
      id: 'description',
      label: 'Description is set',
      ok: Boolean(bot.description?.trim()),
    },
    {
      id: 'accessKey',
      label: 'Access key is present (embed / widget)',
      ok: Boolean(bot.accessKey?.trim()),
    },
    {
      id: 'origins',
      label: 'At least one active allowed origin (required to publish)',
      ok: origins.length > 0,
      detail: origins.length > 0 ? origins.join(', ') : undefined,
    },
  ];
  return {
    checks,
    isReady: checks.every((c) => c.ok),
  };
}
