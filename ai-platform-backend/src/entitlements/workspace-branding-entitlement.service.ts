import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import {
  applyBrandingEntitlementToChatUi,
  isBrandingHiddenInChatUi,
  PLAN_LIMIT_REMOVE_BRANDING_CODE,
  PLAN_LIMIT_REMOVE_BRANDING_MESSAGE,
  type PlanLimitRemoveBrandingPayload,
} from './workspace-branding-entitlement.util';

export {
  PLAN_LIMIT_REMOVE_BRANDING_CODE,
  PLAN_LIMIT_REMOVE_BRANDING_MESSAGE,
  DEFAULT_POWERED_BY_BRANDING_MESSAGE,
} from './workspace-branding-entitlement.util';

export function isPlanLimitRemoveBrandingPayload(x: unknown): x is PlanLimitRemoveBrandingPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as PlanLimitRemoveBrandingPayload).errorCode === PLAN_LIMIT_REMOVE_BRANDING_CODE
  );
}

@Injectable()
export class WorkspaceBrandingEntitlementService {
  constructor(private readonly entitlementsService: WorkspaceEntitlementsService) {}

  async assertCanHideBranding(workspaceId: string, chatUI: unknown): Promise<void> {
    if (!isBrandingHiddenInChatUi(chatUI)) return;
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    if (entitlements.canRemoveBranding) return;

    const payload: PlanLimitRemoveBrandingPayload = {
      message: PLAN_LIMIT_REMOVE_BRANDING_MESSAGE,
      errorCode: PLAN_LIMIT_REMOVE_BRANDING_CODE,
    };
    throw new HttpException(payload, HttpStatus.FORBIDDEN);
  }

  async applyBrandingEntitlementToChatUi<T extends Record<string, unknown>>(
    workspaceId: string | null | undefined,
    chatUI: T,
  ): Promise<T> {
    if (!workspaceId?.trim()) {
      return applyBrandingEntitlementToChatUi(chatUI, false);
    }
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId.trim());
    return applyBrandingEntitlementToChatUi(chatUI, entitlements.canRemoveBranding);
  }
}
