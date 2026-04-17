import type { AllowedOrigin } from '../../bots/origin-validation.util';

/** Default allowed origins for Assistrio marketing / app hosts (seed & pack bots). */
export const ASSISTRIO_EMBED_ALLOWED_ORIGINS: AllowedOrigin[] = [
  { origin: 'https://assistrio.com', label: 'Assistrio', isActive: true },
  { origin: 'https://www.assistrio.com', label: 'Assistrio (www)', isActive: true },
  { origin: 'https://app.assistrio.com', label: 'Assistrio app', isActive: true },
];
