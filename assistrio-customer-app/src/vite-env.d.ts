/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Optional override for widget CSS/JS host (default https://widget.assistrio.com). */
  readonly VITE_WIDGET_ASSET_ORIGIN?: string;
  /** Optional support/contact page URL for public flows (e.g. invite page footer). */
  readonly VITE_SUPPORT_URL?: string;
  /** Public marketing/landing site origin (e.g. https://assistrio.com). */
  readonly VITE_LANDING_SITE_URL?: string;
  /** Terms of Service URL for public invite consent copy. */
  readonly VITE_TERMS_OF_SERVICE_URL?: string;
  /** Privacy Policy URL for public invite consent copy. */
  readonly VITE_PRIVACY_POLICY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
