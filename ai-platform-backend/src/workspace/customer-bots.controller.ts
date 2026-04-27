import { Body, Controller, HttpException, HttpStatus, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { uploadToS3 } from '../lib/s3';
import {
  parseDatasheetFileBuffer,
  DATASHEET_PREVIEW_MAX_ROWS,
} from './datasheet-import.util';
import {
  getExtFromFileNameForDatasheet,
  guessContentTypeByExt,
  readDatasheetFileFromMultipart,
} from './datasheet-import-request.util';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { BOT_FIELD_MAX, clampStr, KNOWLEDGE_TABLES_MAX } from './shared/bot-field-limits';
import { normalizeWorkspaceBotPatch } from './shared/bot-payload';
import { parseBotLifecycleActionBody } from './shared/bot-lifecycle-action.dto';
import { publicApiBaseUrlFromRequest } from './shared/public-api-url.util';
import { WorkspaceBotsControllerBase } from './shared/workspace-bots.controller.base';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/** Customer workspace bot APIs (`/api/customer/bots/*`; `ar_customer_session` only). */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotsController extends WorkspaceBotsControllerBase {
  private readonly importLogger = new Logger(CustomerBotsController.name);

  constructor(
    botsService: BotsService,
    documentsService: DocumentsService,
    botOnboardingService: BotOnboardingService,
    knowledgeBaseItemService: KnowledgeBaseItemService,
    knowledgeBaseChunkService: KnowledgeBaseChunkService,
    workspacesService: WorkspacesService,
  ) {
    super(
      botsService,
      documentsService,
      botOnboardingService,
      knowledgeBaseItemService,
      knowledgeBaseChunkService,
      workspacesService,
    );
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
    await this.assertCanAccessWorkspaceBot(req, id);
    const publicApiBase = publicApiBaseUrlFromRequest(req);
    const widgetAsset =
      process.env.CHAT_WIDGET_ASSET_ORIGIN?.trim().replace(/\/$/, '') || 'https://widget.assistrio.com';
    try {
      return await this.botsService.customerBotLifecycleAction(id, parsed.action, {
        publicApiBaseUrl: publicApiBase,
        widgetAssetOrigin: widgetAsset,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lifecycle action failed';
      if (msg === 'Bot not found') {
        throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      }
      if (
        msg.includes('Name is required') ||
        msg.includes('Description is required') ||
        msg.includes('allowed embed origin')
      ) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      console.error('[customer-bots] lifecycle-action failed', err);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Multipart: field `file` (CSV, XLS, XLSX; max 10MB). Parses the first sheet and returns column headers and up to
   * {@link DATASHEET_PREVIEW_MAX_ROWS} data rows for preview. Does not persist.
   */
  @Post(':id/datasheets/preview')
  async previewDatasheet(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);
    const r = req as FastifyRequest & {
      parts: () => AsyncIterableIterator<
        | { type: 'file'; fieldname: string; filename?: string; mimetype: string; toBuffer: () => Promise<Buffer> }
        | { type: 'field'; fieldname: string; value: string }
      >;
    };
    const { buffer, originalName } = await readDatasheetFileFromMultipart(r, (msg) => this.importLogger.error(msg));
    const parsed = parseDatasheetFileBuffer(buffer, originalName);
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
    const totalDataRows = parsed.rows.length;
    const previewRows = parsed.rows.slice(0, DATASHEET_PREVIEW_MAX_ROWS);
    return {
      ok: true as const,
      fileName: originalName,
      columns: parsed.columns,
      previewRows,
      totalDataRows,
    };
  }

  /**
   * Multipart: field `file` (CSV, XLS, XLSX; max 10MB per sheet). Uploads a copy to S3, parses on the server, appends a datasheet to the bot.
   */
  @Post(':id/datasheets/import')
  async importDatasheet(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);
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

    let s3: { bucket: string; key: string };
    try {
      const result = await uploadToS3({
        visibility: 'private',
        prefix: `uploads/datasheets/${id}`,
        originalName,
        contentType,
        body: buffer,
      });
      s3 = { bucket: result.bucket, key: result.key };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.importLogger.error(`datasheet S3 upload failed: ${msg}`);
      throw new HttpException(
        { error: 'File storage is not available. Try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const parsed = parseDatasheetFileBuffer(buffer, originalName);
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

    const bot = (await this.botsService.findOne(id)) as Record<string, unknown> | null;
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const current = Array.isArray(bot.knowledgeDatasheets)
      ? (bot.knowledgeDatasheets as unknown[])
      : Array.isArray((bot as { knowledgeTables?: unknown }).knowledgeTables)
        ? ((bot as { knowledgeTables: unknown[] }).knowledgeTables as unknown[])
        : [];
    if (current.length >= KNOWLEDGE_TABLES_MAX) {
      throw new HttpException(
        { error: `At most ${KNOWLEDGE_TABLES_MAX} datasheets are allowed. Remove one before importing another.` },
        HttpStatus.BAD_REQUEST,
      );
    }

    const baseTitle = originalName.replace(/\.[^.]+$/i, '').trim() || 'Imported datasheet';
    const title = clampStr(baseTitle, BOT_FIELD_MAX.knowledgeDatasheetTitle) || 'Datasheet';
    const newTable = {
      title,
      columns: parsed.columns,
      rows: parsed.rows,
      active: true,
      importFileSize: buffer.length,
      importFileName: originalName,
    };
    const next = [...current, newTable] as Array<Record<string, unknown>>;

    const patch = normalizeWorkspaceBotPatch({ knowledgeDatasheets: next });
    if (!patch.knowledgeDatasheets) {
      throw new HttpException({ error: 'Could not import datasheet' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const sheetIndex = patch.knowledgeDatasheets.length - 1;

    try {
      await this.botsService.updateWorkspaceBot(id, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      this.importLogger.error(`datasheet import updateWorkspaceBot: ${msg}`);
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return {
      ok: true as const,
      botId: id,
      sheetIndex,
      sourceFile: s3,
    };
  }
}
