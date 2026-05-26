export type AssistrioEmailLogoAssets = {
  /** Logo mark (icon) — from EMAIL_LOGO_PATH_1. */
  markUrl: string | null;
  /** Logo text/word — from EMAIL_LOGO_PATH_2. */
  textUrl: string | null;
};

export type ResolveAssistrioEmailLogoUrlInput = {
  logoPath1?: string | null;
  logoPath2?: string | null;
};

export function isUsableEmailLogoUrl(url: string | null | undefined): boolean {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveLogoUrl(value: string | null | undefined): string | null {
  const url = String(value ?? '').trim();
  return isUsableEmailLogoUrl(url) ? url : null;
}

export function resolveAssistrioEmailLogoAssets(
  input: ResolveAssistrioEmailLogoUrlInput = {},
): AssistrioEmailLogoAssets {
  return {
    markUrl: resolveLogoUrl(input.logoPath1),
    textUrl: resolveLogoUrl(input.logoPath2),
  };
}
