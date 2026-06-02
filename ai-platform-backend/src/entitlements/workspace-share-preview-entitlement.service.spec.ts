import { HttpException, HttpStatus } from '@nestjs/common';
import {
  PLAN_LIMIT_SHARE_PREVIEW_CODE,
  WorkspaceSharePreviewEntitlementService,
} from './workspace-share-preview-entitlement.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('WorkspaceSharePreviewEntitlementService', () => {
  const resolveForWorkspace = jest.fn();

  function makeSvc() {
    const entitlementsService = { resolveForWorkspace } as unknown as WorkspaceEntitlementsService;
    return new WorkspaceSharePreviewEntitlementService(entitlementsService);
  }

  beforeEach(() => {
    resolveForWorkspace.mockReset();
  });

  it('blocks share preview for Free plan', async () => {
    resolveForWorkspace.mockResolvedValue({ sharePreviewAllowed: false });
    const svc = makeSvc();
    await expect(svc.assertCanUseSharePreview('ws-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    try {
      await svc.assertCanUseSharePreview('ws-1');
    } catch (err) {
      expect((err as HttpException).getResponse()).toMatchObject({
        errorCode: PLAN_LIMIT_SHARE_PREVIEW_CODE,
      });
    }
  });

  it('allows share preview for Starter/Pro', async () => {
    resolveForWorkspace.mockResolvedValue({ sharePreviewAllowed: true });
    const svc = makeSvc();
    await expect(svc.assertCanUseSharePreview('ws-1')).resolves.toBeUndefined();
  });

  it('assertCanUseSharePreviewForBot resolves workspace from bot doc', async () => {
    resolveForWorkspace.mockResolvedValue({ sharePreviewAllowed: true });
    const svc = makeSvc();
    await expect(
      svc.assertCanUseSharePreviewForBot({ workspaceId: '507f1f77bcf86cd799439011' }),
    ).resolves.toBeUndefined();
    expect(resolveForWorkspace).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('skips entitlement check when bot has no workspaceId', async () => {
    const svc = makeSvc();
    await expect(svc.assertCanUseSharePreviewForBot({})).resolves.toBeUndefined();
    expect(resolveForWorkspace).not.toHaveBeenCalled();
  });
});
