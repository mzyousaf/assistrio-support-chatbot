import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  PLAN_LIMIT_SHARE_PREVIEW_CODE,
  PLAN_LIMIT_SHARE_PREVIEW_MESSAGE,
  type PlanLimitSharePreviewPayload,
} from './share-preview-entitlement.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

export {
  PLAN_LIMIT_SHARE_PREVIEW_CODE,
  PLAN_LIMIT_SHARE_PREVIEW_MESSAGE,
} from './share-preview-entitlement.util';

export function isPlanLimitSharePreviewPayload(x: unknown): x is PlanLimitSharePreviewPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as PlanLimitSharePreviewPayload).errorCode === PLAN_LIMIT_SHARE_PREVIEW_CODE
  );
}

@Injectable()
export class WorkspaceSharePreviewEntitlementService {
  constructor(private readonly entitlementsService: WorkspaceEntitlementsService) {}

  async assertCanUseSharePreview(workspaceId: string): Promise<void> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    if (entitlements.sharePreviewAllowed) return;

    const payload: PlanLimitSharePreviewPayload = {
      message: PLAN_LIMIT_SHARE_PREVIEW_MESSAGE,
      errorCode: PLAN_LIMIT_SHARE_PREVIEW_CODE,
    };
    throw new HttpException(payload, HttpStatus.FORBIDDEN);
  }

  async assertCanUseSharePreviewForBot(row: Record<string, unknown>): Promise<void> {
    const workspaceId = row.workspaceId != null ? String(row.workspaceId).trim() : '';
    if (!workspaceId) return;
    await this.assertCanUseSharePreview(workspaceId);
  }
}
