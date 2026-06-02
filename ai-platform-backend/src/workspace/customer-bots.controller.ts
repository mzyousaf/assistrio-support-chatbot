import { Body, Controller, Get, HttpException, HttpStatus, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeUsageService } from '../knowledge/knowledge-usage.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { uploadToS3 } from '../lib/s3';
import {
  parseDatasheetFileBuffer,
  DATASHEET_PREVIEW_MAX_ROWS,
  isDatasheetCsvFileName,
} from './datasheet-import.util';
import { KNOWLEDGE_TABLES_MAX, tableImportXlsxMaxBytesFromEnv } from './shared/bot-field-limits';
import {
  getExtFromFileNameForDatasheet,
  guessContentTypeByExt,
  readDatasheetFileFromMultipart,
} from './datasheet-import-request.util';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { normalizeBotPayload } from './shared/bot-payload';
import { assertAllowedOriginsPolicy } from './shared/allowed-origins-policy';
import { parseBotLifecycleActionBody } from './shared/bot-lifecycle-action.dto';
import { publicApiBaseUrlFromRequest } from './shared/public-api-url.util';
import { WorkspaceBotsControllerBase } from './shared/workspace-bots.controller.base';

import { isWorkspaceManagerRole, isWorkspaceOwnerRole } from '../models/workspace-membership-role.util';
import { BotKnowledgeTotalLimitService } from '../knowledge/bot-knowledge-total-limit.service';
import { TableImportService } from '../ingestion/table-import.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';

function parseCustomerListingDraftBody(body: unknown): {
  clientDraftId: string;
  workspaceId?: string;
  listingOverrides?: {
    name?: string;
    description?: string;
    shortDescription?: string;
    category?: string;
    brandColor?: string;
  };
} | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const clientDraftId = typeof o.clientDraftId === 'string' ? o.clientDraftId.trim() : '';
  if (!clientDraftId) return null;
  const workspaceId =
    typeof o.workspaceId === 'string' && o.workspaceId.trim() ? o.workspaceId.trim() : undefined;
  const pick = (key: string): string | undefined => {
    const v = o[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const listingOverrides = {
    name: pick('name'),
    description: pick('description'),
    shortDescription: pick('shortDescription'),
    category: pick('category'),
    brandColor: pick('brandColor'),
  };
  const hasOverrides = Object.values(listingOverrides).some(Boolean);
  return {
    clientDraftId,
    workspaceId,
    ...(hasOverrides ? { listingOverrides } : {}),
  };
}

function parseDatasheetImportCancelBody(body: unknown): { importSessionId: string } | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const sidRaw = o.importSessionId;
  const sid = typeof sidRaw === 'string' && Types.ObjectId.isValid(sidRaw.trim()) ? sidRaw.trim() : null;
  if (!sid) return null;
  return { importSessionId: sid };
}

function parseDatasheetImportConfirmBody(body: unknown): {
  importSessionId: string;
  title?: string;
  dropColumnIndices?: number[];
} | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const sidRaw = o.importSessionId;
  const sid = typeof sidRaw === 'string' && Types.ObjectId.isValid(sidRaw.trim()) ? sidRaw.trim() : null;
  if (!sid) return null;
  const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : undefined;
  let dropColumnIndices: number[] | undefined;
  if (Array.isArray(o.dropColumnIndices)) {
    dropColumnIndices = o.dropColumnIndices
      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 1_000_000)
      .map((x) => Math.floor(x));
    if (dropColumnIndices.length === 0) dropColumnIndices = undefined;
  }
  return { importSessionId: sid, title, dropColumnIndices };
}

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/** Customer workspace bot APIs (`/api/customer/bots/*`; `ar_customer_session` only). */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotsController extends WorkspaceBotsControllerBase {
  private readonly importLogger = new Logger(CustomerBotsController.name);

  protected requiresWorkspaceAdminForMutations(): boolean {
    return true;
  }

  protected override async assertBotDetailAccessAllowed(
    _req: RequestWithUser,
    botId: string,
    bot: Record<string, unknown>,
  ): Promise<void> {
    const workspaceId = bot.workspaceId != null ? String(bot.workspaceId).trim() : '';
    if (!workspaceId) return;
    await this.workspaceBotLimitService.assertWorkspaceBotWithinEffectiveLimit(workspaceId, botId);
  }

  constructor(
    botsService: BotsService,
    documentsService: DocumentsService,
    botOnboardingService: BotOnboardingService,
    knowledgeBaseItemService: KnowledgeBaseItemService,
    workspacesService: WorkspacesService,
    knowledgeUsageService: KnowledgeUsageService,
    private readonly tableImportService: TableImportService,
    private readonly botKbTotalLimit: BotKnowledgeTotalLimitService,
    private readonly workspaceBotLimitService: WorkspaceBotLimitService,
  ) {
    super(
      botsService,
      documentsService,
      botOnboardingService,
      knowledgeBaseItemService,
      workspacesService,
      knowledgeUsageService,
    );
  }

  @Get()
  override async listBots(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('workspaceId') workspaceIdQuery?: string,
  ) {
    const filter = status === 'draft' || status === 'published' ? status : 'all';
    const userId = req?.user?._id != null ? String(req.user._id) : '';

    let workspaceId: string | null;
    const explicitWorkspaceId = workspaceIdQuery?.trim();
    if (explicitWorkspaceId) {
      if (!Types.ObjectId.isValid(explicitWorkspaceId)) {
        throw new HttpException({ error: 'Invalid workspaceId' }, HttpStatus.BAD_REQUEST);
      }
      const isMember = await this.workspacesService.isUserMemberOfWorkspace(userId, explicitWorkspaceId);
      if (!isMember) {
        throw new HttpException(
          { error: 'Workspace access denied.', errorCode: 'workspace_access_denied' },
          HttpStatus.FORBIDDEN,
        );
      }
      workspaceId = explicitWorkspaceId;
    } else {
      workspaceId = await this.workspacesService.resolveActiveWorkspaceForUser(userId);
    }

    if (!workspaceId) {
      return [];
    }

    const memberRole = await this.workspacesService.getUserWorkspaceMemberRole(userId, workspaceId);
    let bots = await this.botsService.findForCustomerWorkspaceList(filter, workspaceId);
    if (memberRole == null || !isWorkspaceOwnerRole(memberRole)) {
      bots = (await this.workspacesService.filterWorkspaceBotsForUser(
        userId,
        workspaceId,
        bots as Record<string, unknown>[],
      )) as typeof bots;
    }
    const botIds = (bots as Record<string, unknown>[]).map((b) => String(b._id));
    const statsMap = await this.botsService.getListStatsForBots(botIds);
    const workspaceName = await this.workspacesService.getWorkspaceDisplayName(workspaceId);

    let viewAccessPreviewByBotId: Record<string, import('../workspaces/workspace-bot-access-grant.util').BotViewAccessPreviewMember[]> | undefined;
    if (memberRole != null && isWorkspaceManagerRole(memberRole) && botIds.length > 0) {
      viewAccessPreviewByBotId = await this.workspacesService.buildBotViewAccessPreviewByBotIds(
        workspaceId,
        botIds,
      );
    }

    const lockedIds = await this.workspaceBotLimitService.resolveOverLimitLockedBotIdSet(workspaceId);
    const mapped = this.mapBotRecordsToListResponse(bots as Record<string, unknown>[], statsMap, {
      workspaceName: workspaceName ?? undefined,
      viewAccessPreviewByBotId,
    });
    const enriched = this.workspaceBotLimitService.enrichBotListWithOverLimitState(mapped, lockedIds);

    if (memberRole != null && !isWorkspaceManagerRole(memberRole)) {
      return enriched.filter((bot) => !bot.isOverLimitLocked);
    }

    return enriched;
  }

  @Post('draft')
  override async createDraft(
    @Body() body: {
      clientDraftId?: string;
      workspaceId?: string;
      name?: string;
      description?: string;
      shortDescription?: string;
      category?: string;
      brandColor?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    const parsed = parseCustomerListingDraftBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'clientDraftId is required' }, HttpStatus.BAD_REQUEST);
    }
    const { clientDraftId, workspaceId: explicitWorkspaceId, listingOverrides } = parsed;
    const createdByUserId = req.user?._id != null ? String(req.user._id) : undefined;
    if (!createdByUserId) {
      throw new HttpException({ error: 'Customer session required.' }, HttpStatus.FORBIDDEN);
    }

    let targetWorkspaceId: string;
    if (explicitWorkspaceId) {
      if (!Types.ObjectId.isValid(explicitWorkspaceId)) {
        throw new HttpException({ error: 'Invalid workspaceId' }, HttpStatus.BAD_REQUEST);
      }
      const isMember = await this.workspacesService.isUserMemberOfWorkspace(createdByUserId, explicitWorkspaceId);
      if (!isMember) {
        throw new HttpException(
          { error: 'Workspace access denied.', errorCode: 'workspace_access_denied' },
          HttpStatus.FORBIDDEN,
        );
      }
      targetWorkspaceId = explicitWorkspaceId;
    } else {
      const activeWorkspaceId = await this.workspacesService.resolveActiveWorkspaceForUser(createdByUserId);
      if (activeWorkspaceId) {
        targetWorkspaceId = activeWorkspaceId;
      } else {
        targetWorkspaceId = String(await this.workspacesService.ensurePersonalWorkspaceForUser(createdByUserId));
      }
    }

    await this.workspacesService.assertWorkspaceAdmin(createdByUserId, targetWorkspaceId);

    try {
      const result = await this.botsService.createDraft(clientDraftId, createdByUserId, {
        enforceWorkspaceBotLimit: true,
        applyWorkspaceEntitlements: true,
        workspaceId: targetWorkspaceId,
        source: 'customer_listing',
        listingOverrides,
      });
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Create draft bot failed', err);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('draft/finalize')
  override async finalizeDraft(
    @Body() body: { clientDraftId?: string; payload?: Record<string, unknown> },
    @Req() req: RequestWithUser,
  ) {
    const clientDraftId = String(body?.clientDraftId ?? '').trim();
    if (!clientDraftId) {
      throw new HttpException({ error: 'clientDraftId is required' }, HttpStatus.BAD_REQUEST);
    }
    const draftBot = await this.botsService.findWorkspaceByClientDraftId(clientDraftId);
    if (draftBot?._id != null) {
      await this.assertCanManageWorkspaceBot(req, String(draftBot._id));
    }
    const normalized = normalizeBotPayload(body?.payload ?? {});
    if (normalized.allowedOrigins !== undefined) {
      assertAllowedOriginsPolicy(normalized.allowedOrigins.length, req.user?.role);
    }
    const createdByUserId = req.user?._id != null ? String(req.user._id) : undefined;
    try {
      return await this.botsService.finalizeDraft(clientDraftId, normalized, createdByUserId, {
        enforceWorkspaceBotLimit: true,
        applyWorkspaceEntitlements: true,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('Finalize draft bot failed', err);
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('allowed origin') ||
        msg.includes('allowed embed origin') ||
        msg.includes('Document extraction is still in progress')
      ) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Dedicated publish/draft lifecycle (not sparse PATCH). Validates business rules, updates `status`, returns embed snippet on publish.
   */
  @Post(':id/lifecycle-action')
  async postBotLifecycleAction(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const parsed = parseBotLifecycleActionBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'action must be "publish" or "draft"' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanManageWorkspaceBot(req, id);
    const publicApiBase = publicApiBaseUrlFromRequest(req);
    const widgetAsset =
      process.env.CHAT_WIDGET_ASSET_ORIGIN?.trim().replace(/\/$/, '') || 'https://widget.assistrio.com';
    try {
      return await this.botsService.customerBotLifecycleAction(id, parsed.action, {
        publicApiBaseUrl: publicApiBase,
        widgetAssetOrigin: widgetAsset,
        enforceWorkspaceBotLimit: true,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Lifecycle action failed';
      if (msg === 'AI Agent not found') {
        throw new HttpException({ error: 'AI Agent not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
      }
      if (
        msg.includes('Name is required') ||
        msg.includes('Description is required') ||
        msg.includes('allowed embed origin') ||
        msg.includes('Document extraction is still in progress')
      ) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      console.error('[customer-bots] lifecycle-action failed', err);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Multipart: field `file` (CSV, XLS, XLSX; max 20MB). Stores file in S3, parses first sheet headers + up to
   * {@link DATASHEET_PREVIEW_MAX_ROWS} data rows for preview, creates a short-lived import session.
   */
  @Post(':id/datasheets/preview')
  async previewDatasheet(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanManageWorkspaceBot(req, id);
    await this.botKbTotalLimit.assertStoredBytesBelowCapForNewContent(id);
    const r = req as FastifyRequest & {
      parts: () => AsyncIterableIterator<
        | { type: 'file'; fieldname: string; filename?: string; mimetype: string; toBuffer: () => Promise<Buffer> }
        | { type: 'field'; fieldname: string; value: string }
      >;
    };
    const { buffer, originalName, fileMimetype } = await readDatasheetFileFromMultipart(
      r,
      (msg) => this.importLogger.error(msg),
    );
    const ext = getExtFromFileNameForDatasheet(originalName);
    const contentType = fileMimetype || guessContentTypeByExt(ext);
    const xlsxMax = tableImportXlsxMaxBytesFromEnv();
    const parsed = parseDatasheetFileBuffer(buffer, originalName, {
      maxDataRows: DATASHEET_PREVIEW_MAX_ROWS,
      maxSourceBytes: isDatasheetCsvFileName(originalName) ? undefined : xlsxMax,
    });
    if (parsed.parseErrorCode === 'xlsx_too_large') {
      throw new HttpException(
        {
          error: parsed.parseError,
          code: 'xlsx_too_large',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    if (parsed.parseErrorCode === 'xlsx_too_many_physical_rows') {
      throw new HttpException(
        {
          error: parsed.parseError,
          code: 'xlsx_too_many_physical_rows',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (parsed.parseErrorCode === 'cell_too_long') {
      throw new HttpException(
        {
          error: parsed.parseError,
          code: 'cell_too_long',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (parsed.parseError && parsed.columns.length === 0) {
      throw new HttpException(
        { error: parsed.parseError || 'Could not read this spreadsheet. Try a different file or export format.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (parsed.columns.length === 0 || parsed.columns.every((c) => c.trim() === '')) {
      throw new HttpException(
        { error: 'No column headers found. Put headers in the first row of the first sheet.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (parsed.rows.length === 0) {
      throw new HttpException(
        {
          error:
            'No data rows found after the header row. Add at least one non-empty data row (header-only sheets are not imported).',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    let s3: { bucket: string; key: string };
    try {
      const result = await uploadToS3({
        visibility: 'private',
        prefix: `uploads/table-import-sessions/${id}`,
        originalName,
        contentType,
        body: buffer,
      });
      s3 = { bucket: result.bucket, key: result.key };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.importLogger.error(`datasheet preview S3 upload failed: ${msg}`);
      throw new HttpException(
        { error: 'File storage is not available. Try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const previewRows = parsed.rows;
    const estimatedDataRows = parsed.estimatedDataRows ?? previewRows.length;
    const { importSessionId } = await this.tableImportService.createImportSession({
      botId: id,
      s3Bucket: s3.bucket,
      s3Key: s3.key,
      originalFileName: originalName,
      fileSizeBytes: buffer.length,
      contentType,
      columns: parsed.columns,
      previewRows,
      estimatedDataRows,
    });
    return {
      ok: true as const,
      importSessionId,
      fileName: originalName,
      columns: parsed.columns,
      previewRows,
      fileSizeBytes: buffer.length,
      totalDataRows: estimatedDataRows,
      estimatedDataRows,
    };
  }

  /**
   * JSON: `{ importSessionId }` — abandon preview: deletes temp S3 object and marks session cancelled.
   */
  @Post(':id/datasheets/import-cancel')
  async cancelDatasheetImport(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanManageWorkspaceBot(req, id);
    const parsed = parseDatasheetImportCancelBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'importSessionId is required (valid ObjectId).' }, HttpStatus.BAD_REQUEST);
    }
    try {
      const out = await this.tableImportService.cancelImportSession(id, parsed.importSessionId);
      return out;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'session_not_found') {
        throw new HttpException(
          { error: 'Import session not found.', code: 'session_not_found' },
          HttpStatus.NOT_FOUND,
        );
      }
      if (msg === 'session_already_consumed') {
        throw new HttpException(
          { error: 'This import was already confirmed.', code: 'session_already_consumed' },
          HttpStatus.CONFLICT,
        );
      }
      if (msg === 'invalid_ids') {
        throw new HttpException({ error: 'Invalid request.', code: 'invalid_ids' }, HttpStatus.BAD_REQUEST);
      }
      this.importLogger.error(`datasheet import-cancel: ${msg}`);
      throw new HttpException({ error: 'Could not cancel import preview.' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * JSON: `{ importSessionId, title?, dropColumnIndices? }` — queues background parse from session S3 object.
   * Returns immediately (202-style payload with ok); training runs after import via scopes TrainJob.
   */
  @Post(':id/datasheets/import-confirm')
  async confirmDatasheetImport(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanManageWorkspaceBot(req, id);
    await this.botKbTotalLimit.assertStoredBytesBelowCapForNewContent(id);
    const parsed = parseDatasheetImportConfirmBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'importSessionId is required (valid ObjectId).' }, HttpStatus.BAD_REQUEST);
    }
    try {
      const bot = await this.botsService.findOne(id);
      if (!bot) {
        throw new HttpException({ error: 'AI Agent not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
      }
      const out = await this.tableImportService.confirmTableImport(id, parsed.importSessionId, {
        title: parsed.title,
        dropColumnIndices: parsed.dropColumnIndices,
      });
      return { ...out, httpAccepted: true as const };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'import_session_expired') {
        throw new HttpException(
          { error: 'This import preview expired. Upload the file again.', code: 'import_session_expired' },
          HttpStatus.GONE,
        );
      }
      if (msg === 'import_session_cancelled') {
        throw new HttpException(
          { error: 'This import preview was cancelled. Upload the file again.', code: 'import_session_cancelled' },
          HttpStatus.GONE,
        );
      }
      if (msg === 'session_already_consumed') {
        throw new HttpException(
          { error: 'This import was already confirmed.', code: 'session_already_consumed' },
          HttpStatus.CONFLICT,
        );
      }
      if (msg === 'session_not_found') {
        throw new HttpException(
          { error: 'Import session not found.', code: 'session_not_found' },
          HttpStatus.NOT_FOUND,
        );
      }
      if (msg === 'table_limit') {
        throw new HttpException(
          {
            error: `Each agent can have at most ${KNOWLEDGE_TABLES_MAX} datasheets. Remove one before importing another.`,
            code: 'table_limit',
            maxDatasheets: KNOWLEDGE_TABLES_MAX,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (msg === 'invalid_ids') {
        throw new HttpException({ error: 'Invalid request.', code: 'invalid_ids' }, HttpStatus.BAD_REQUEST);
      }
      if (msg === 'import_limit_concurrent') {
        throw new HttpException(
          {
            error: 'Too many datasheet imports are already running for this agent. Wait for one to finish, then try again.',
            code: 'import_limit_concurrent',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (msg === 'import_limit_daily') {
        throw new HttpException(
          {
            error: 'Daily datasheet import limit reached for this agent. Try again tomorrow.',
            code: 'import_limit_daily',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.importLogger.error(`datasheet import-confirm: ${msg}`);
      throw new HttpException({ error: 'Could not start import.' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @deprecated Use POST `datasheets/preview` then `datasheets/import-confirm`.
   */
  @Post(':id/datasheets/import')
  async importDatasheet(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    throw new HttpException(
      {
        error:
          'Synchronous datasheet import is removed. Call POST .../datasheets/preview, then POST .../datasheets/import-confirm with importSessionId.',
        code: 'async_import_required',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
