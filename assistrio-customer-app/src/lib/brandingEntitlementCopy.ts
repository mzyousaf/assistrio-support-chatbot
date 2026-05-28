export const PLAN_LIMIT_REMOVE_BRANDING_CODE = 'plan_limit_remove_branding' as const;

export const PLAN_LIMIT_REMOVE_BRANDING_MESSAGE =
  'Removing Assistrio branding requires the branding removal add-on.';

export const BRANDING_REMOVAL_LOCKED_HELPER =
  'Powered by Assistrio can be removed with the branding add-on.';

export function resolveBrandingSaveErrorMessage(result: {
  error?: string;
  errorCode?: string;
}): string {
  if (result.errorCode === PLAN_LIMIT_REMOVE_BRANDING_CODE) {
    return PLAN_LIMIT_REMOVE_BRANDING_MESSAGE;
  }
  return result.error?.trim() || 'Something went wrong. Please try again.';
}

/** Keep Assistrio branding visible in local editor/preview when workspace cannot remove it. */
export function applyBrandingEntitlementToLocalChatUi(
  chatUi: Record<string, unknown>,
  canRemoveBranding: boolean,
): Record<string, unknown> {
  if (canRemoveBranding) return chatUi;
  return {
    ...chatUi,
    showAssistrioBrandingPaid: true,
  };
}
