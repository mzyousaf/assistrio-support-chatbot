import { HttpException, HttpStatus } from '@nestjs/common';
import {
  PLAN_LIMIT_EXPORT_REPORTS_CODE,
  WorkspaceExportReportEntitlementService,
} from './workspace-export-report-entitlement.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('WorkspaceExportReportEntitlementService', () => {
  const resolveForWorkspace = jest.fn();

  function makeSvc() {
    const entitlementsService = { resolveForWorkspace } as unknown as WorkspaceEntitlementsService;
    return new WorkspaceExportReportEntitlementService(entitlementsService);
  }

  beforeEach(() => {
    resolveForWorkspace.mockReset();
  });

  it('blocks export for Free plan', async () => {
    resolveForWorkspace.mockResolvedValue({ canExportReports: false });
    const svc = makeSvc();
    await expect(svc.assertCanExportReports('ws-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    try {
      await svc.assertCanExportReports('ws-1');
    } catch (err) {
      expect((err as HttpException).getResponse()).toMatchObject({
        errorCode: PLAN_LIMIT_EXPORT_REPORTS_CODE,
      });
    }
  });

  it('allows export for Starter/Pro', async () => {
    resolveForWorkspace.mockResolvedValue({ canExportReports: true });
    const svc = makeSvc();
    await expect(svc.assertCanExportReports('ws-1')).resolves.toBeUndefined();
  });
});
