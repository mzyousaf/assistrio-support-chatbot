import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { BotsService } from './bots.service';
import {
  DEFAULT_POWERED_BY_BRANDING_MESSAGE,
  PLAN_LIMIT_REMOVE_BRANDING_CODE,
} from '../entitlements/workspace-branding-entitlement.util';

describe('BotsService branding entitlement enforcement', () => {
  const id = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();

  function makeSvc(options: { canRemoveBranding: boolean }) {
    const findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(id),
        workspaceId: new Types.ObjectId(workspaceId),
        status: 'draft',
        name: 'Bot',
        slug: 'bot',
        chatUI: { showBranding: true },
      }),
    });
    const findOneAndUpdate = jest.fn().mockResolvedValue({});
    const brandingService = {
      assertCanHideBranding: jest.fn().mockImplementation(async (_ws: string, chatUI: unknown) => {
        if (options.canRemoveBranding) return;
        if (chatUI && typeof chatUI === 'object' && (chatUI as { showBranding?: boolean }).showBranding === false) {
          throw new HttpException(
            { errorCode: PLAN_LIMIT_REMOVE_BRANDING_CODE, message: 'blocked' },
            HttpStatus.FORBIDDEN,
          );
        }
      }),
      applyBrandingEntitlementToChatUi: jest.fn().mockImplementation(async (_ws: string, chatUI: Record<string, unknown>) => {
        if (options.canRemoveBranding) return chatUI;
        return {
          ...chatUI,
          showBranding: true,
          brandingMessage:
            typeof chatUI.brandingMessage === 'string' && chatUI.brandingMessage.trim()
              ? chatUI.brandingMessage.trim()
              : DEFAULT_POWERED_BY_BRANDING_MESSAGE,
        };
      }),
    };
    const svc = Object.create(BotsService.prototype) as {
      updateWorkspaceBot: BotsService['updateWorkspaceBot'];
      sanitizeRuntimeChatUiForBot: BotsService['sanitizeRuntimeChatUiForBot'];
      botModel: { findOne: typeof findOne; findOneAndUpdate: typeof findOneAndUpdate };
      assertDocumentsExtractedBeforePublish: jest.Mock;
      workspaceBrandingEntitlementService: typeof brandingService;
    };
    svc.botModel = { findOne, findOneAndUpdate };
    svc.assertDocumentsExtractedBeforePublish = jest.fn().mockResolvedValue(undefined);
    svc.workspaceBrandingEntitlementService = brandingService;
    return { svc, findOneAndUpdate, brandingService };
  }

  it('updateWorkspaceBot blocks showBranding=false when canRemoveBranding=false', async () => {
    const { svc, brandingService } = makeSvc({ canRemoveBranding: false });
    await expect(
      svc.updateWorkspaceBot(id, {
        touched: new Set(['chatUI']),
        chatUI: { showBranding: false } as never,
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(brandingService.assertCanHideBranding).toHaveBeenCalledWith(workspaceId, { showBranding: false });
  });

  it('updateWorkspaceBot allows showBranding=false when canRemoveBranding=true', async () => {
    const { svc, findOneAndUpdate } = makeSvc({ canRemoveBranding: true });
    await svc.updateWorkspaceBot(id, {
      touched: new Set(['chatUI']),
      chatUI: { showBranding: false } as never,
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ chatUI: { showBranding: false } }),
    );
  });

  it('sanitizeRuntimeChatUiForBot forces branding visible when entitlement false', async () => {
    const { svc } = makeSvc({ canRemoveBranding: false });
    const out = await svc.sanitizeRuntimeChatUiForBot({
      workspaceId,
      chatUI: { showBranding: false, brandingMessage: '' },
    });
    expect(out.showBranding).toBe(true);
    expect(out.brandingMessage).toBe(DEFAULT_POWERED_BY_BRANDING_MESSAGE);
  });
});
