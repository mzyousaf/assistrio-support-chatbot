export const PLAN_LIMIT_REMOVE_BRANDING_CODE = 'plan_limit_remove_branding' as const;

export const PLAN_LIMIT_REMOVE_BRANDING_MESSAGE =
  'Removing Assistrio branding requires the branding removal add-on.';

export const DEFAULT_POWERED_BY_BRANDING_MESSAGE = 'Powered by Assistrio';

export type PlanLimitRemoveBrandingPayload = {
  message: string;
  errorCode: typeof PLAN_LIMIT_REMOVE_BRANDING_CODE;
};

export function isAssistrioBrandingHiddenInChatUi(chatUI: unknown): boolean {
  if (!chatUI || typeof chatUI !== 'object' || Array.isArray(chatUI)) return false;
  const ui = chatUI as { showAssistrioBrandingPaid?: boolean };
  return ui.showAssistrioBrandingPaid === false;
}

/** @deprecated Use {@link isAssistrioBrandingHiddenInChatUi}. Kept for tests referencing old name. */
export const isBrandingHiddenInChatUi = isAssistrioBrandingHiddenInChatUi;

/** Force "Show Assistrio branding" visible when the workspace cannot remove it. */
export function applyBrandingEntitlementToChatUi<T extends Record<string, unknown>>(
  chatUI: T,
  canRemoveBranding: boolean,
): T {
  if (canRemoveBranding) return chatUI;
  return {
    ...chatUI,
    showAssistrioBrandingPaid: true,
  };
}
