import { HttpException, HttpStatus } from '@nestjs/common';

/** Allowed link lifetimes for POST/PATCH share preview (hours). */
export const SHARE_PREVIEW_ALLOWED_EXPIRES_HOURS = [
  6, 12, 24, 48, 72, 96, 120, 144, 168,
] as const;

export type SharePreviewExpiresInHours = (typeof SHARE_PREVIEW_ALLOWED_EXPIRES_HOURS)[number];

export function assertAllowedSharePreviewExpiresInHours(n: unknown): SharePreviewExpiresInHours {
  const x = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : NaN;
  if (!SHARE_PREVIEW_ALLOWED_EXPIRES_HOURS.includes(x as SharePreviewExpiresInHours)) {
    throw new HttpException(
      {
        error: 'expiresInHours must be one of: 6, 12, 24, 48, 72, 96, 120, 144, 168',
        errorCode: 'INVALID_SHARE_EXPIRES_HOURS',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
  return x as SharePreviewExpiresInHours;
}

export function sharePreviewExpiryDateFromHours(hours: SharePreviewExpiresInHours, from: Date = new Date()): Date {
  return new Date(from.getTime() + hours * 3_600_000);
}
