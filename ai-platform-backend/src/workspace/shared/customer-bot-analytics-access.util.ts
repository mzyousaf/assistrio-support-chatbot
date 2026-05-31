import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../../auth/shared/request-user.types';
import type { BotsService } from '../../bots/bots.service';
import type { WorkspaceAnalyticsEntitlementService } from '../../entitlements/workspace-analytics-entitlement.service';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import { workspaceIdFromBotRecord } from './customer-analytics-entitlement.types';
import { clampCustomerAnalyticsQueryDates } from './customer-bot-analytics-request.util';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

export async function requireCustomerBotAnalyticsAccess(args: {
  req: RequestWithUser;
  botId: string;
  botsService: BotsService;
  workspacesService: WorkspacesService;
  analyticsEntitlementService: WorkspaceAnalyticsEntitlementService;
  forbiddenCode?: string;
}): Promise<{
  bot: Record<string, unknown>;
  workspaceId: string;
  analyticsHistoryDays: number | null;
}> {
  const bot = await args.botsService.findOne(args.botId);
  if (!bot) {
    throw new NotFoundException('AI Agent not found');
  }
  const uid = args.req.user?._id != null ? String(args.req.user._id) : '';
  const ok = await args.workspacesService.canUserAccessWorkspaceBot(
    uid,
    args.req.user?.role ?? '',
    bot as Record<string, unknown>,
  );
  if (!ok) {
    throw new ForbiddenException({
      error: 'Forbidden',
      ...(args.forbiddenCode ? { errorCode: args.forbiddenCode } : {}),
    });
  }

  const workspaceId = workspaceIdFromBotRecord(bot as Record<string, unknown>);
  const analyticsHistoryDays = workspaceId
    ? await args.analyticsEntitlementService.resolveAnalyticsHistoryDays(workspaceId)
    : null;

  return { bot: bot as Record<string, unknown>, workspaceId, analyticsHistoryDays };
}

export function clampAnalyticsFromToQuery(
  from: string | undefined,
  to: string | undefined,
  analyticsHistoryDays: number | null,
) {
  return clampCustomerAnalyticsQueryDates(from, to, analyticsHistoryDays);
}
