export const DEFAULT_POWERED_BY_BRANDING_MESSAGE = "Powered by Assistrio";

export function resolveBrandingFooterDisplay(chatUI?: {
  showBranding?: boolean;
  brandingMessage?: string;
}): { showBrandingLine: boolean; brandingMessage?: string } {
  if (chatUI?.showBranding === false) {
    return { showBrandingLine: false, brandingMessage: undefined };
  }
  const message =
    (typeof chatUI?.brandingMessage === "string" ? chatUI.brandingMessage.trim() : "") ||
    DEFAULT_POWERED_BY_BRANDING_MESSAGE;
  return { showBrandingLine: true, brandingMessage: message };
}
