import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  PLAN_LIMIT_EXPORT_REPORTS_CODE,
  PLAN_LIMIT_EXPORT_REPORTS_MESSAGE,
  type PlanLimitExportReportsPayload,
} from './export-report-entitlement.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

export {
  PLAN_LIMIT_EXPORT_REPORTS_CODE,
  PLAN_LIMIT_EXPORT_REPORTS_MESSAGE,
} from './export-report-entitlement.util';

export function isPlanLimitExportReportsPayload(x: unknown): x is PlanLimitExportReportsPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as PlanLimitExportReportsPayload).errorCode === PLAN_LIMIT_EXPORT_REPORTS_CODE
  );
}

@Injectable()
export class WorkspaceExportReportEntitlementService {
  constructor(private readonly entitlementsService: WorkspaceEntitlementsService) {}

  async assertCanExportReports(workspaceId: string): Promise<void> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    if (entitlements.canExportReports) return;

    const payload: PlanLimitExportReportsPayload = {
      message: PLAN_LIMIT_EXPORT_REPORTS_MESSAGE,
      errorCode: PLAN_LIMIT_EXPORT_REPORTS_CODE,
    };
    throw new HttpException(payload, HttpStatus.FORBIDDEN);
  }
}
