import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { KnowledgeOverviewService } from './knowledge-overview.service';
import { KnowledgeItemManualRetryService } from './knowledge-item-manual-retry.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { CustomerKnowledgeItemPrimarySourceAnalyticsService } from '../analytics/customer-knowledge-item-primary-source-analytics.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { assertKnowledgeTrainQueueRateLimit } from './shared/knowledge-train-queue-rate-limit.util';
import {
  normalizeWorkspaceKnowledgeFaqsArray,
  normalizeWorkspaceKnowledgeSnippetsArray,
} from './shared/bot-payload';
import { CsvIncrementalParser } from './datasheet-csv-stream.util';
import { KNOWLEDGE_QA_MAX, KNOWLEDGE_SNIPPETS_MAX } from './shared/bot-field-limits';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function parseSuggestionIndexParam(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new HttpException({ error: 'Invalid suggestion index' }, HttpStatus.BAD_REQUEST);
  }
  return n;
}

function parseKbRowIndexParam(raw: string, label: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new HttpException({ error: `Invalid ${label}` }, HttpStatus.BAD_REQUEST);
  }
  return n;
}

function parseJsonObjectBody(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpException({ error: 'Invalid body' }, HttpStatus.BAD_REQUEST);
  }
  return body as Record<string, unknown>;
}

function parseJsonArrayBody(body: unknown): unknown[] {
  if (!Array.isArray(body)) {
    throw new HttpException({ error: 'Body must be a JSON array', errorCode: 'invalid_body' }, HttpStatus.BAD_REQUEST);
  }
  return body;
}

function parseSuggestionLabelBody(body: unknown): string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpException({ error: 'Invalid body' }, HttpStatus.BAD_REQUEST);
  }
  const label = (body as { label?: unknown }).label;
  if (typeof label !== 'string') {
    throw new HttpException({ error: 'label must be a string' }, HttpStatus.BAD_REQUEST);
  }
  return label;
}

function parseSuggestionScopeBody(body: unknown): string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpException({ error: 'Invalid body' }, HttpStatus.BAD_REQUEST);
  }
  const context = (body as { context?: unknown }).context;
  if (typeof context !== 'string') {
    throw new HttpException({ error: 'context must be a string' }, HttpStatus.BAD_REQUEST);
  }
  return context;
}

function parseSuggestionHideChipTextBody(body: unknown): boolean {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpException({ error: 'Invalid body' }, HttpStatus.BAD_REQUEST);
  }
  const v = (body as { hideChipTextInChat?: unknown }).hideChipTextInChat;
  if (typeof v !== 'boolean') {
    throw new HttpException(
      { error: 'hideChipTextInChat must be boolean', errorCode: 'invalid_body' },
      HttpStatus.BAD_REQUEST,
    );
  }
  return v;
}

function parseKnowledgeBulkDeleteItemIdsBody(body: unknown): string[] {
  const o = parseJsonObjectBody(body);
  const raw = o.itemIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpException(
      { error: 'itemIds must be a non-empty array', errorCode: 'invalid_body' },
      HttpStatus.BAD_REQUEST,
    );
  }
  return raw.map((x) => String(x ?? '').trim());
}

const KB_IMPORT_MAX_ROWS = 100;
const KB_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;

type CsvImportErrorRow = { row: number; column: string; message: string };

async function readSingleCsvFileFromMultipart(r: FastifyRequest): Promise<{ buffer: Buffer; fileName: string }> {
  type Part =
    | { type: 'file'; fieldname: string; filename?: string; toBuffer: () => Promise<Buffer> }
    | { type: 'field'; fieldname: string; value: string };
  const req = r as FastifyRequest & { parts: () => AsyncIterableIterator<Part> };
  let buffer: Buffer | null = null;
  let fileName = '';
  for await (const part of req.parts()) {
    if (part.type !== 'file' || part.fieldname !== 'file') continue;
    if (buffer) {
      throw new HttpException(
        { error: 'One file at a time. Use a single "file" field.', errorCode: 'invalid_body' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const b = await part.toBuffer();
    const name = String(part.filename ?? '').trim();
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    if (ext !== 'csv') {
      throw new HttpException(
        { error: 'Unsupported file type. Use a .csv file.', errorCode: 'unsupported_file_type' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!b.length) {
      throw new HttpException({ error: 'CSV file is empty.', errorCode: 'empty_file' }, HttpStatus.BAD_REQUEST);
    }
    if (b.length > KB_IMPORT_MAX_FILE_BYTES) {
      throw new HttpException(
        { error: 'CSV file is too large (max 2 MB).', errorCode: 'file_too_large' },
        HttpStatus.BAD_REQUEST,
      );
    }
    buffer = b;
    fileName = name || 'import.csv';
  }
  if (!buffer) {
    throw new HttpException({ error: 'Missing file. Send a multipart field named "file".' }, HttpStatus.BAD_REQUEST);
  }
  return { buffer, fileName };
}

function parseCsvBufferToRows(buffer: Buffer): string[][] {
  try {
    const parser = new CsvIncrementalParser();
    const rowsFromPush = parser.pushChunk(buffer);
    const rowsFromEnd = parser.end();
    const all = [...rowsFromPush, ...rowsFromEnd].map((r) => r.map((c) => String(c ?? '').trim()));
    return all.filter((r) => r.some((c) => c.length > 0));
  } catch {
    throw new HttpException(
      { error: 'Could not parse CSV file. Check formatting and retry.', errorCode: 'csv_invalid' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function headerIndexMap(header: string[]): Map<string, number> {
  const m = new Map<string, number>();
  header.forEach((h, i) => m.set(h.trim().toLowerCase(), i));
  return m;
}

@Controller('api/customer/bots/:id/knowledge')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerKnowledgeController {
  constructor(
    private readonly knowledgeOverview: KnowledgeOverviewService,
    private readonly knowledgeItemManualRetry: KnowledgeItemManualRetryService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly rateLimitService: RateLimitService,
    private readonly knowledgeItemPrimarySourceAnalytics: CustomerKnowledgeItemPrimarySourceAnalyticsService,
  ) {}

  private async assertCanAccess(req: RequestWithUser, botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'AI Agent not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(uid, req.user?.role ?? '', bot as Record<string, unknown>);
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
  }

  private async assertCanManage(req: RequestWithUser, botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'AI Agent not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const role = req.user?.role ?? '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(uid, role, bot as Record<string, unknown>);
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
    await this.workspacesService.assertCanManageWorkspaceBot(uid, role, bot as Record<string, unknown>);
  }

  @Post('items/bulk-delete')
  async bulkDeleteKnowledgeItems(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      const itemIds = parseKnowledgeBulkDeleteItemIdsBody(body);
      return await this.knowledgeBaseItemService.workspaceBulkDeleteKnowledgeItemsByRouteIds(id, itemIds);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] POST items/bulk-delete', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('items/:itemId/retry')
  async retryKnowledgeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      return await this.knowledgeItemManualRetry.manualRetry(id, itemId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] items/:itemId/retry', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('items/:itemId')
  async deleteKnowledgeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      return await this.knowledgeBaseItemService.workspaceDeleteKnowledgeItemByRouteId(id, itemId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] DELETE items/:itemId', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('items/:itemId/use-in-replies')
  async patchKnowledgeItemUseInReplies(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      const o = parseJsonObjectBody(body);
      const useInReplies = o.useInReplies;
      if (typeof useInReplies !== 'boolean') {
        throw new HttpException(
          { error: 'useInReplies must be boolean', errorCode: 'invalid_body' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const ok = await this.knowledgeBaseItemService.setKnowledgeItemActiveById(id, itemId, useInReplies);
      if (!ok) {
        throw new HttpException(
          { error: 'Knowledge item not found', errorCode: 'kb_item_not_found' },
          HttpStatus.NOT_FOUND,
        );
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] PATCH items/:itemId/use-in-replies', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** Primary-source usage over time for one KnowledgeBaseItem (tenant-safe aggregates only). */
  @Get('items/:itemId/primary-source-analytics')
  async getKnowledgeItemPrimarySourceAnalytics(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: string,
    @Query('includePreview') includePreview?: string,
    @Query('startedFrom') startedFrom?: string,
  ) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeItemPrimarySourceAnalytics.get(id, itemId, {
        from,
        to,
        granularity,
        includePreview,
        startedFrom,
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] GET items/:itemId/primary-source-analytics', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('training/status')
  async getTrainingStatusAggregate(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.getAgentTrainingStatus(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] training/status', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** Pending KB items grouped by section (titles only; no private suggestion body). */
  /** Action-needed KB rows: pending, failed, and queued with runAfter in the future (same basis as sidebar count). */
  @Get('training/pending-items')
  async getPendingTrainingItems(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.getPendingTrainingItems(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] training/pending-items', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('training/retrain-agent')
  async retrainAgent(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    await assertKnowledgeTrainQueueRateLimit(
      this.rateLimitService,
      id,
      req.user?._id != null ? String(req.user._id) : '',
    );
    try {
      return await this.knowledgeOverview.retrainAgent(id, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] retrain-agent', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('overview')
  async getOverview(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.getOverviewForBot(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] overview', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('status')
  async getKnowledgeStatus(
    @Param('id') id: string,
    @Query('type') type: string | undefined,
    @Query('itemId') itemId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.listKnowledgeItemStatus(id, type, itemId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] status', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('faqs')
  async postFaqAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeFaqAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] POST faqs', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('faqs/:faqIndex')
  async patchFaqRow(
    @Param('id') id: string,
    @Param('faqIndex') faqIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      const idx = parseKbRowIndexParam(faqIndex, 'FAQ index');
      const payload = parseJsonObjectBody(body);
      await this.botsService.patchWorkspaceBotKnowledgeFaqAtIndex(id, idx, payload);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] faqs/:faqIndex', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('faqs/import-csv-sample')
  getFaqCsvSample() {
    return {
      fileName: 'qa-import-sample.csv',
      content:
        'title,questions,answer\nShipping and returns,When do you ship?|How long is delivery?,We ship within 1-2 business days.\nRefund policy,Can I get a refund?|How do returns work?,You can request a refund within 30 days with your order number.\n',
    };
  }

  @Post('faqs/import-csv')
  async importFaqsCsv(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    const { buffer, fileName } = await readSingleCsvFileFromMultipart(req);
    const csvRows = parseCsvBufferToRows(buffer);
    if (csvRows.length < 2) {
      throw new HttpException(
        { error: 'CSV must include a header and at least one data row.', errorCode: 'csv_invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const [header, ...bodyRows] = csvRows;
    const idx = headerIndexMap(header);
    if (!idx.has('title') || !idx.has('questions') || !idx.has('answer')) {
      throw new HttpException(
        {
          error: 'Invalid CSV headers. Required: title, questions, answer.',
          errorCode: 'csv_invalid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (bodyRows.length > KB_IMPORT_MAX_ROWS) {
      throw new HttpException(
        { error: `At most ${KB_IMPORT_MAX_ROWS} rows can be imported at once.`, errorCode: 'csv_too_many_rows' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const validationErrors: CsvImportErrorRow[] = [];
    const incoming: Array<{ title: string; questions: string[]; answer: string; active: true }> = [];
    bodyRows.forEach((row, i) => {
      const rowNo = i + 2;
      const title = String(row[idx.get('title') ?? -1] ?? '').trim();
      const questionsRaw = String(row[idx.get('questions') ?? -1] ?? '').trim();
      const answer = String(row[idx.get('answer') ?? -1] ?? '').trim();
      const questions = questionsRaw
        .split('|')
        .map((q) => q.trim())
        .filter(Boolean);
      if (!answer) validationErrors.push({ row: rowNo, column: 'answer', message: 'Answer is required.' });
      if (!title && questions.length === 0) {
        validationErrors.push({
          row: rowNo,
          column: 'questions',
          message: 'Provide at least one question or a title.',
        });
      }
      incoming.push({ title, questions, answer, active: true });
    });
    if (validationErrors.length > 0) {
      throw new HttpException(
        { error: 'CSV has invalid rows. Fix and retry.', errorCode: 'csv_invalid_rows', details: validationErrors },
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.knowledgeBaseItemService.getFaqsForBot(id, { includeInactive: true });
    const remaining = Math.max(0, KNOWLEDGE_QA_MAX - existing.length);
    const acceptedIncoming = remaining > 0 ? incoming.slice(0, remaining) : [];
    const skippedDueToCapacity = Math.max(0, incoming.length - acceptedIncoming.length);
    if (acceptedIncoming.length === 0) {
      return { ok: true as const, imported: 0, skippedDueToCapacity, fileName };
    }
    const normalized = normalizeWorkspaceKnowledgeFaqsArray([...existing, ...acceptedIncoming]);
    if (normalized.length !== existing.length + acceptedIncoming.length) {
      throw new HttpException(
        {
          error: 'Some rows became invalid after normalization. Fix CSV and retry.',
          errorCode: 'csv_invalid_rows',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.assertWorkspaceBotPatchKnowledgeTrainingGates(id, {
      faqCount: normalized.length,
      suggestionCount: 0,
      snippetCount: 0,
      knowledgeDescriptionOnlyTouchedWithoutSnippets: false,
      tableCount: 0,
    });
    await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(id, normalized);
    return { ok: true as const, imported: acceptedIncoming.length, skippedDueToCapacity, fileName };
  }

  @Post('snippets')
  async postSnippetAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeSnippetAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] POST snippets', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('snippets/:snippetIndex')
  async patchSnippetRow(
    @Param('id') id: string,
    @Param('snippetIndex') snippetIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      const idx = parseKbRowIndexParam(snippetIndex, 'snippet index');
      const payload = parseJsonObjectBody(body);
      await this.botsService.patchWorkspaceBotKnowledgeSnippetAtIndex(id, idx, payload);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] snippets/:snippetIndex', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('snippets/import-csv-sample')
  getSnippetCsvSample() {
    return {
      fileName: 'snippets-import-sample.csv',
      content:
        'title,snippet\nReturn policy,Customers can request returns within 30 days of purchase with proof of order.\nSupport hours,Live chat support is available Monday-Friday 9 AM to 6 PM.\n',
    };
  }

  @Post('snippets/import-csv')
  async importSnippetsCsv(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    const { buffer, fileName } = await readSingleCsvFileFromMultipart(req);
    const csvRows = parseCsvBufferToRows(buffer);
    if (csvRows.length < 2) {
      throw new HttpException(
        { error: 'CSV must include a header and at least one data row.', errorCode: 'csv_invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const [header, ...bodyRows] = csvRows;
    const idx = headerIndexMap(header);
    if (!idx.has('title') || !idx.has('snippet')) {
      throw new HttpException(
        { error: 'Invalid CSV headers. Required: title, snippet.', errorCode: 'csv_invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (bodyRows.length > KB_IMPORT_MAX_ROWS) {
      throw new HttpException(
        { error: `At most ${KB_IMPORT_MAX_ROWS} rows can be imported at once.`, errorCode: 'csv_too_many_rows' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const validationErrors: CsvImportErrorRow[] = [];
    const incoming: Array<{ title: string; snippet: string; active: true }> = [];
    bodyRows.forEach((row, i) => {
      const rowNo = i + 2;
      const title = String(row[idx.get('title') ?? -1] ?? '').trim();
      const snippet = String(row[idx.get('snippet') ?? -1] ?? '').trim();
      if (!snippet) validationErrors.push({ row: rowNo, column: 'snippet', message: 'Snippet is required.' });
      incoming.push({ title: title || 'Snippet', snippet, active: true });
    });
    if (validationErrors.length > 0) {
      throw new HttpException(
        { error: 'CSV has invalid rows. Fix and retry.', errorCode: 'csv_invalid_rows', details: validationErrors },
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.knowledgeBaseItemService.getSnippetsForBot(id, { includeInactive: true });
    const remaining = Math.max(0, KNOWLEDGE_SNIPPETS_MAX - existing.length);
    const acceptedIncoming = remaining > 0 ? incoming.slice(0, remaining) : [];
    const skippedDueToCapacity = Math.max(0, incoming.length - acceptedIncoming.length);
    if (acceptedIncoming.length === 0) {
      return { ok: true as const, imported: 0, skippedDueToCapacity, fileName };
    }
    const normalized = normalizeWorkspaceKnowledgeSnippetsArray([...existing, ...acceptedIncoming]);
    if (normalized.length !== existing.length + acceptedIncoming.length) {
      throw new HttpException(
        {
          error: 'Some rows became invalid after normalization. Fix CSV and retry.',
          errorCode: 'csv_invalid_rows',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.assertWorkspaceBotPatchKnowledgeTrainingGates(id, {
      faqCount: 0,
      suggestionCount: 0,
      snippetCount: normalized.length,
      knowledgeDescriptionOnlyTouchedWithoutSnippets: false,
      tableCount: 0,
    });
    await this.knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot(id, normalized);
    return { ok: true as const, imported: acceptedIncoming.length, skippedDueToCapacity, fileName };
  }

  @Post('datasheets')
  async postDatasheetAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeDatasheetAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] POST datasheets', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('datasheets/:tableIndex')
  async patchDatasheetRow(
    @Param('id') id: string,
    @Param('tableIndex') tableIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      const idx = parseKbRowIndexParam(tableIndex, 'datasheet index');
      const payload = parseJsonObjectBody(body);
      await this.botsService.patchWorkspaceBotKnowledgeTableAtIndex(id, idx, payload);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] datasheets/:tableIndex', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('suggestions/sync')
  async postSuggestionsSync(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      const list = parseJsonArrayBody(body);
      await this.botsService.syncWorkspaceBotKnowledgeSuggestionsFromPayload(id, list);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] POST suggestions/sync', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('suggestions')
  async postSuggestionAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeSuggestionAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] POST suggestions', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('description')
  async patchKnowledgeDescription(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      await this.botsService.patchWorkspaceBotKnowledgeDescription(id, body);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] PATCH description', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('suggestions/:suggestionIndex/label')
  async patchSuggestionLabel(
    @Param('id') id: string,
    @Param('suggestionIndex') suggestionIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      const idx = parseSuggestionIndexParam(suggestionIndex);
      const label = parseSuggestionLabelBody(body);
      await this.knowledgeBaseItemService.patchCustomerSuggestionChipLabel(id, idx, label);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] suggestions/:index/label', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('suggestions/:suggestionIndex/scope')
  async patchSuggestionScope(
    @Param('id') id: string,
    @Param('suggestionIndex') suggestionIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      const idx = parseSuggestionIndexParam(suggestionIndex);
      const context = parseSuggestionScopeBody(body);
      await this.knowledgeBaseItemService.patchCustomerSuggestionScope(id, idx, context);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] suggestions/:index/scope', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('suggestions/:suggestionIndex/hide-chip-text')
  async patchSuggestionHideChipText(
    @Param('id') id: string,
    @Param('suggestionIndex') suggestionIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanManage(req, id);
    try {
      const idx = parseSuggestionIndexParam(suggestionIndex);
      const hideChipTextInChat = parseSuggestionHideChipTextBody(body);
      await this.knowledgeBaseItemService.patchCustomerSuggestionHideChipTextInChat(id, idx, hideChipTextInChat);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] suggestions/:index/hide-chip-text', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('training-settings')
  async patchTrainingSettings(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanManage(req, id);
    try {
      return await this.knowledgeOverview.patchTrainingSettings(id, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-knowledge] training-settings', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
