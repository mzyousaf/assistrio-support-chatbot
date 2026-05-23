import { BadRequestException } from '@nestjs/common';
import type { AllowedOrigin } from '../bots/origin-validation.util';

export const ONBOARDING_ALLOWED_ORIGINS_MAX = 3;

export const ONBOARDING_ALLOWED_ORIGINS_LIMIT_MESSAGE =
  'You can add up to 3 allowed origins during onboarding.';

export const ONBOARDING_ALLOWED_ORIGINS_LIMIT_ERROR_CODE = 'onboarding_allowed_origins_limit_reached';

type OriginRow = { origin: string; label?: string; isActive?: boolean };

function originKey(origin: string): string {
  return origin.trim().toLowerCase();
}

/** Keep first occurrence of each normalized origin. */
export function dedupeOnboardingAllowedOrigins<T extends OriginRow>(origins: readonly T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const row of origins) {
    const origin = String(row.origin ?? '').trim();
    if (!origin) continue;
    const key = originKey(origin);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...row, origin });
  }
  return deduped;
}

export function assertOnboardingAllowedOriginsLimit(origins: readonly OriginRow[]): void {
  const deduped = dedupeOnboardingAllowedOrigins(origins);
  if (deduped.length > ONBOARDING_ALLOWED_ORIGINS_MAX) {
    throw new BadRequestException({
      error: ONBOARDING_ALLOWED_ORIGINS_LIMIT_MESSAGE,
      errorCode: ONBOARDING_ALLOWED_ORIGINS_LIMIT_ERROR_CODE,
    });
  }
}

export function mergeOnboardingAllowedOriginWithinLimit(
  origins: AllowedOrigin[],
  origin: string,
  label?: string,
): AllowedOrigin[] {
  const normalized = origin.trim();
  const without = origins.filter((row) => originKey(row.origin) !== originKey(normalized));
  const merged = [...without, { origin: normalized, ...(label ? { label } : {}), isActive: true }];
  assertOnboardingAllowedOriginsLimit(merged);
  return dedupeOnboardingAllowedOrigins(merged);
}
