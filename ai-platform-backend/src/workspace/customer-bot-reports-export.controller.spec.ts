import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { CustomerChatsAnalyticsService } from '../analytics/customer-chats-analytics.service';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { PLAN_LIMIT_EXPORT_REPORTS_CODE } from '../entitlements/workspace-export-report-entitlement.service';
import { WorkspaceExportReportEntitlementService } from '../entitlements/workspace-export-report-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CustomerBotReportsExportController } from './customer-bot-reports-export.controller';

describe('CustomerBotReportsExportController', () => {
  let ctrl: CustomerBotReportsExportController;
  const findOneMock = jest.fn();
  const canAccessMock = jest.fn();
  const assertExportMock = jest.fn();
  const listLeadsMock = jest.fn();
  const chatsAnalyticsMock = jest.fn();

  beforeEach(async () => {
    findOneMock.mockReset();
    canAccessMock.mockReset();
    assertExportMock.mockReset();
    listLeadsMock.mockReset();
    chatsAnalyticsMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerBotReportsExportController],
      providers: [
        { provide: BotsService, useValue: { findOne: findOneMock } },
        { provide: WorkspacesService, useValue: { canUserAccessWorkspaceBot: canAccessMock } },
        { provide: WorkspaceExportReportEntitlementService, useValue: { assertCanExportReports: assertExportMock } },
        { provide: ChatEngineService, useValue: { listBotLeadsForWorkspace: listLeadsMock } },
        { provide: CustomerChatsAnalyticsService, useValue: { get: chatsAnalyticsMock } },
      ],
    })
      .overrideGuard(CustomerSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = module.get(CustomerBotReportsExportController);
  });

  it('blocks leads export for Free plan', async () => {
    findOneMock.mockResolvedValue({ _id: new Types.ObjectId(), workspaceId: new Types.ObjectId() });
    canAccessMock.mockResolvedValue(true);
    assertExportMock.mockRejectedValue(
      new HttpException(
        { errorCode: PLAN_LIMIT_EXPORT_REPORTS_CODE, message: 'blocked' },
        HttpStatus.FORBIDDEN,
      ),
    );

    await expect(
      ctrl.exportLeadsCsv({ user: { _id: 'u1', role: 'owner' }, query: {} } as never, 'bot1', {
        header: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as never),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('blocks export when bot access denied', async () => {
    findOneMock.mockResolvedValue({ _id: new Types.ObjectId(), workspaceId: new Types.ObjectId() });
    canAccessMock.mockResolvedValue(false);
    await expect(
      ctrl.exportLeadsCsv({ user: { _id: 'u1', role: 'member' }, query: {} } as never, 'bot1', {
        header: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assertExportMock).not.toHaveBeenCalled();
  });

  it('allows leads export for entitled workspace', async () => {
    findOneMock.mockResolvedValue({ _id: new Types.ObjectId(), workspaceId: new Types.ObjectId() });
    canAccessMock.mockResolvedValue(true);
    assertExportMock.mockResolvedValue(undefined);
    listLeadsMock.mockResolvedValue({ leads: [{ conversationId: 'c1', startedFrom: 'runtime_widget' }] });
    const send = jest.fn();
    const header = jest.fn().mockReturnThis();

    await ctrl.exportLeadsCsv({ user: { _id: 'u1', role: 'owner' }, query: {} } as never, 'bot1', {
      header,
      send,
    } as never);

    expect(assertExportMock).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(expect.stringContaining('Conversation ID'));
  });
});
