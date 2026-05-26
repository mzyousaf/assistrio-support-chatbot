export const CUSTOMER_AVATAR_MAX_MB = 5;
export const CUSTOMER_AVATAR_MAX_BYTES = CUSTOMER_AVATAR_MAX_MB * 1024 * 1024;
export const CUSTOMER_AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function customerAvatarMaxSizeMessage(): string {
  return `Image must be under ${CUSTOMER_AVATAR_MAX_MB}MB.`;
}

export function validateCustomerAvatarFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: 'Use a PNG, JPG, or WebP image.' };
  }
  if (file.size > CUSTOMER_AVATAR_MAX_BYTES) {
    return { ok: false, error: customerAvatarMaxSizeMessage() };
  }
  return { ok: true };
}
