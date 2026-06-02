export const DEFAULT_POWERED_BY_BRANDING_MESSAGE = "Powered by Assistrio";
export const DEFAULT_PRIVACY_FOOTER_MESSAGE = "Your conversations are private and secure.";

export function resolveBrandingFooterDisplay(chatUI?: {
  showBranding?: boolean;
  brandingMessage?: string;
}): { showBrandingLine: boolean; brandingMessage?: string } {
  if (chatUI?.showBranding === false) {
    return { showBrandingLine: false, brandingMessage: undefined };
  }
  const message =
    typeof chatUI?.brandingMessage === "string" ? chatUI.brandingMessage.trim() : "";
  return {
    showBrandingLine: true,
    brandingMessage: message || DEFAULT_POWERED_BY_BRANDING_MESSAGE,
  };
}

export function resolvePrivacyFooterDisplay(
  chatUI?: { showPrivacyText?: boolean; privacyText?: string },
  footerPrivacyText?: string,
): { showPrivacyLine: boolean; privacyText?: string } {
  if (chatUI?.showPrivacyText === false) {
    return { showPrivacyLine: false, privacyText: undefined };
  }
  const message =
    (typeof chatUI?.privacyText === "string" ? chatUI.privacyText.trim() : "") ||
    (typeof footerPrivacyText === "string" ? footerPrivacyText.trim() : "");
  return {
    showPrivacyLine: true,
    privacyText: message || DEFAULT_PRIVACY_FOOTER_MESSAGE,
  };
}
