/** Public marketing site origin (no trailing slash). */
export function getLandingSiteUrl(): string {
  const env = (import.meta.env.VITE_LANDING_SITE_URL ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  if (import.meta.env.DEV) return 'http://localhost:3001';
  return 'https://assistrio.com';
}
