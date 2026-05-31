import { ForbiddenException, Get, NotFoundException, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Controller } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerChatsAnalyticsService } from '../analytics/customer-chats-analytics.service';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { parseWorkspaceLeadsListFilters } from '../chat/workspace-conversation-serialize.util';
import { WorkspaceExportReportEntitlementService } from '../entitlements/workspace-export-report-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { workspaceIdFromBotRecord } from './shared/customer-analytics-entitlement.types';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function pickQueryParam(
  query: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = query[key];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

function escapeCsvCell(value: string): string {
  const v = String(value ?? '');
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotReportsExportController {
  constructor(
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly exportReportEntitlementService: WorkspaceExportReportEntitlementService,
    private readonly chatEngineService: ChatEngineService,
    private readonly customerChatsAnalyticsService: CustomerChatsAnalyticsService,
  ) {}

  private async requireWorkspaceBot(req: RequestWithUser, botId: string) {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new NotFoundException('AI Agent not found');
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }
    return bot;
  }

  @Get(':id/reports/leads/export')
  async exportLeadsCsv(@Req() req: RequestWithUser, @Param('id') id: string, @Res() res: FastifyReply) {
    const bot = await this.requireWorkspaceBot(req, id);
    const workspaceId = workspaceIdFromBotRecord(bot as Record<string, unknown>);
    if (workspaceId) {
      await this.exportReportEntitlementService.assertCanExportReports(workspaceId);
    }

    const q = (req.query ?? {}) as Record<string, string | string[] | undefined>;
    const filters = parseWorkspaceLeadsListFilters(q);
    const rows = await this.chatEngineService.listBotLeadsForWorkspace({
      botOid: new Types.ObjectId(String((bot as { _id: unknown })._id)),
      limit: 5000,
      skip: 0,
      page: 1,
      beforeSortAtIso: null,
      filters,
      leadCapture: (bot as { leadCapture?: unknown }).leadCapture,
    });

    const headers = ['Captured at', 'Conversation ID', 'Started from', 'Country', 'City'];
    const lines = [headers.map(escapeCsvCell).join(',')];
    for (const lead of rows.leads ?? []) {
      const row = lead as {
        leadCapturedAt?: string;
        lastActivityAt?: string;
        conversationId?: string;
        startedFrom?: string;
        location?: { country?: string; city?: string };
      };
      lines.push(
        [
          row.leadCapturedAt ?? row.lastActivityAt ?? '',
          row.conversationId ?? '',
          row.startedFrom ?? '',
          row.location?.country ?? '',
          row.location?.city ?? '',
        ]
          .map(escapeCsvCell)
          .join(','),
      );
    }

    const csv = `\uFEFF${lines.join('\r\n')}`;
    res
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="assistrio-leads.csv"')
      .send(csv);
  }

  @Get(':id/reports/analytics/chats-top-pages/export')
  async exportChatsTopPagesCsv(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query() query: Record<string, string | string[] | undefined>,
    @Res() res: FastifyReply,
  ) {
    const bot = await this.requireWorkspaceBot(req, id);
    const workspaceId = workspaceIdFromBotRecord(bot as Record<string, unknown>);
    if (workspaceId) {
      await this.exportReportEntitlementService.assertCanExportReports(workspaceId);
    }

    const analytics = await this.customerChatsAnalyticsService.get(id, {
      from: pickQueryParam(query, 'from'),
      to: pickQueryParam(query, 'to'),
      granularity: pickQueryParam(query, 'granularity'),
      includePreview: pickQueryParam(query, 'includePreview'),
      startedFrom: pickQueryParam(query, 'startedFrom'),
      countryCode: pickQueryParam(query, 'countryCode'),
      deviceType: pickQueryParam(query, 'deviceType'),
    });

    const headers = ['Page path', 'Page label', 'Website origin', 'Chats', 'Messages'];
    const lines = [headers.map(escapeCsvCell).join(',')];
    for (const row of analytics.topPagesBreakdown ?? []) {
      lines.push(
        [
          row.page ?? '',
          row.pageLabel ?? '',
          row.websiteOrigin ?? '',
          String(row.conversations ?? 0),
          String(row.messages ?? 0),
        ]
          .map(escapeCsvCell)
          .join(','),
      );
    }

    const csv = `\uFEFF${lines.join('\r\n')}`;
    res
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="assistrio-top-pages.csv"')
      .send(csv);
  }
}
