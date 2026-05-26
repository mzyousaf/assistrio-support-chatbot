export const PLAN_LIMIT_REMOVE_BRANDING_CODE = 'plan_limit_remove_branding' as const;

export const PLAN_LIMIT_REMOVE_BRANDING_MESSAGE =
  'Removing Assistrio branding requires the branding removal add-on.';

export const DEFAULT_POWERED_BY_BRANDING_MESSAGE = 'Powered by Assistrio';

export type PlanLimitRemoveBrandingPayload = {
  message: string;
  errorCode: typeof PLAN_LIMIT_REMOVE_BRANDING_CODE;
};

export function isBrandingHiddenInChatUi(chatUI: unknown): boolean {
  if (!chatUI || typeof chatUI !== 'object' || Array.isArray(chatUI)) return false;
  return (chatUI as { showBranding?: boolean }).showBranding === false;
}

/** Force Assistrio branding visible when the workspace cannot remove it. */
export function applyBrandingEntitlementToChatUi<T extends Record<string, unknown>>(
  chatUI: T,
  canRemoveBranding: boolean,
): T {
  if (canRemoveBranding) return chatUI;
  const brandingMessage =
    typeof chatUI.brandingMessage === 'string' && chatUI.brandingMessage.trim()
      ? chatUI.brandingMessage.trim()
      : DEFAULT_POWERED_BY_BRANDING_MESSAGE;
  return {
    ...chatUI,
    showBranding: true,
    brandingMessage,
  };
}
