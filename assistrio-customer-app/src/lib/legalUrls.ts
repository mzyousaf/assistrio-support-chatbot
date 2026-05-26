import { getLandingSiteUrl } from './landingSiteUrl';

function parsePublicHttpUrl(value: string | undefined): string | null {
  const url = String(value ?? '').trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function landingLegalUrl(path: string): string | null {
  const landing = getLandingSiteUrl().trim().replace(/\/$/, '');
  if (!landing) return null;
  return `${landing}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Terms of Service URL from `VITE_TERMS_OF_SERVICE_URL`, or `{landing}/terms`. */
export function getTermsOfServiceUrl(): string | null {
  return parsePublicHttpUrl(import.meta.env.VITE_TERMS_OF_SERVICE_URL) ?? landingLegalUrl('/terms');
}

/** Privacy Policy URL from `VITE_PRIVACY_POLICY_URL`, or `{landing}/privacy`. */
export function getPrivacyPolicyUrl(): string | null {
  return parsePublicHttpUrl(import.meta.env.VITE_PRIVACY_POLICY_URL) ?? landingLegalUrl('/privacy');
}
