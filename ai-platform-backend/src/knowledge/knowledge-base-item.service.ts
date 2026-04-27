import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  KnowledgeBaseItem,
  type KnowledgeBaseItemFaqMeta,
  type KnowledgeBaseItemSourceMeta,
  type KnowledgeBaseItemStatus,
} from '../models/knowledge-base-item.schema';
import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  buildQaEmbeddingText,
  buildTableEmbeddingText,
  computeEmbeddingInputHash,
} from './faq-note-embedding.helper';
import { MAX_DATASHEET_IMPORT_BYTES } from '../documents/bot-document-upload.constants';
import { BOT_FIELD_MAX, clampStr } from '../workspace/shared/bot-field-limits';
import * as crypto from 'crypto';

/** Minimal document shape for syncing from DocumentModel. */
export interface DocumentLikeForSync {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  title: string;
  status?: string;
  active?: boolean;
  text?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  storage?: string;
  s3Bucket?: string;
  s3Key?: string;
  uploadSessionId?: string;
}

function contentHash(input: string): string {
  return crypto.createHash('sha256').update(input || '', 'utf8').digest('hex').slice(0, 32);
}

@Injectable()
export class KnowledgeBaseItemService {
  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
  ) {}

  /**
   * Create or update a KnowledgeBaseItem for a document. Uses documentId for matching.
   * Sets status to queued when content changed; keeps ready if unchanged.
   */
  async upsertDocumentKnowledgeItem(doc: DocumentLikeForSync): Promise<{ id: string; created: boolean }> {
    const botId = doc.botId as Types.ObjectId;
    const docId = doc._id as Types.ObjectId;
    const content = (doc.text ?? '').trim();
    const hash = contentHash(doc.title + '\n' + content);

    const sourceMeta: KnowledgeBaseItemSourceMeta = {};
    if (doc.fileName != null) sourceMeta.fileName = doc.fileName;
    if (doc.fileType != null) sourceMeta.fileType = doc.fileType;
    if (doc.fileSize != null) sourceMeta.fileSize = doc.fileSize;
    if (doc.url != null) sourceMeta.url = doc.url;
    if (doc.storage != null) sourceMeta.storage = doc.storage;
    if (doc.s3Bucket != null) sourceMeta.s3Bucket = doc.s3Bucket;
    if (doc.s3Key != null) sourceMeta.s3Key = doc.s3Key;
    if (doc.uploadSessionId != null) sourceMeta.uploadSessionId = doc.uploadSessionId;

    const existing = await this.itemModel
      .findOne({ botId, documentId: docId, sourceType: 'document' })
      .select('_id contentHash status active')
      .lean();

    const active = doc.active !== false;
    const status = (doc.status === 'ready' ? 'ready' : doc.status === 'failed' ? 'failed' : doc.status === 'processing' ? 'processing' : 'queued') as 'queued' | 'processing' | 'ready' | 'failed';

    if (existing) {
      const sameHash = (existing as { contentHash?: string }).contentHash === hash;
      const nextStatus = sameHash ? status : 'queued';
      await this.itemModel.updateOne(
        { _id: (existing as { _id: Types.ObjectId })._id },
        {
          $set: {
            title: doc.title,
            content,
            rawContent: content || undefined,
            contentHash: hash,
            status: nextStatus,
            active,
            sourceMeta: Object.keys(sourceMeta).length ? sourceMeta : undefined,
            error: undefined,
            processedAt: nextStatus === 'ready' ? new Date() : undefined,
            updatedAt: new Date(),
          },
        },
      );
      return { id: (existing as { _id: Types.ObjectId })._id.toString(), created: false };
    }

    const created = await this.itemModel.create({
      botId,
      documentId: docId,
      title: doc.title,
      sourceType: 'document',
      status: status === 'ready' ? 'ready' : 'queued',
      active,
      content,
      rawContent: content || undefined,
      contentHash: hash,
      sourceMeta: Object.keys(sourceMeta).length ? sourceMeta : undefined,
      processedAt: status === 'ready' ? new Date() : undefined,
    });
    return { id: (created as { _id: Types.ObjectId })._id.toString(), created: true };
  }

  /**
   * Sync all Q&A entries for a bot to KnowledgeBaseItems. Matches by botId + sourceType='faq' + faqMeta.faqIndex.
   * Each row: optional title, multiple `questions` (or legacy `question` as first phrasing), one `answer`.
   */
  async upsertFaqKnowledgeItemsForBot(
    botId: string,
    faqs: Array<{
      title?: string;
      questions?: string[];
      question?: string;
      answer: string;
      active?: boolean;
    }>,
  ): Promise<{ upserted: number; deactivated: number }> {
    const botOid = new Types.ObjectId(botId);
    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'faq' })
      .select('_id faqMeta')
      .lean();

    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { faqMeta?: { faqIndex?: number } }).faqMeta;
      if (meta?.faqIndex != null) byIndex.set(meta.faqIndex, { _id: (item as { _id: Types.ObjectId })._id });
    }

    let upserted = 0;
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i];
      const groupTitle = (faq.title ?? '').trim();
      const rawQuestions = Array.isArray(faq.questions) && faq.questions.length
        ? faq.questions
        : faq.question != null && String(faq.question).trim()
          ? [String(faq.question).trim()]
          : [];
      const questions = rawQuestions.map((q) => String(q ?? '').trim()).filter(Boolean);
      const answer = (faq.answer ?? '').trim();
      const active = faq.active !== false;
      const primaryQ = questions[0] ?? '';
      const itemTitle = groupTitle || primaryQ || `Q&A ${i + 1}`;
      const inputForHash =
        questions.length > 0 || groupTitle
          ? buildQaEmbeddingText(groupTitle, questions, answer)
          : buildFaqEmbeddingText(primaryQ, answer);
      const content = inputForHash;
      const hash = computeEmbeddingInputHash(inputForHash);

      const faqMeta: KnowledgeBaseItemFaqMeta = {
        title: groupTitle || undefined,
        questions: questions.length ? questions : undefined,
        question: primaryQ,
        answer,
        faqIndex: i,
      };

      const existing = byIndex.get(i);
      if (existing) {
        const current = await this.itemModel.findById(existing._id).select('contentHash').lean();
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        await this.itemModel.updateOne(
          { _id: existing._id },
          {
            $set: {
              title: itemTitle,
              content,
              contentHash: hash,
              faqMeta,
              status: active ? (sameHash ? 'ready' : 'queued') : 'ready',
              active,
              updatedAt: new Date(),
            },
          },
        );
        upserted++;
        byIndex.delete(i);
        continue;
      }

      await this.itemModel.create({
        botId: botOid,
        title: itemTitle,
        sourceType: 'faq',
        status: active ? 'queued' : 'ready',
        active,
        content,
        contentHash: hash,
        faqMeta,
      });
      upserted++;
    }

    const deactivated = await this.deactivateMissingFaqKnowledgeItemsForBot(botId, faqs.length);
    return { upserted, deactivated };
  }

  /**
   * Deactivate KnowledgeBaseItems for FAQs that no longer exist at the given indices (by faqIndex >= faqCount).
   */
  async deactivateMissingFaqKnowledgeItemsForBot(botId: string, faqCount: number): Promise<number> {
    const botOid = new Types.ObjectId(botId);
    const result = await this.itemModel.updateMany(
      { botId: botOid, sourceType: 'faq', 'faqMeta.faqIndex': { $gte: faqCount } },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  /**
   * Sync titled snippets: one KnowledgeBaseItem per row (`sourceType: note`, `noteMeta.kind: snippet`, `snippetIndex`).
   * Deactivates legacy `general_note` and unused indices.
   */
  async upsertSnippetKnowledgeItemsForBot(
    botId: string,
    snippets: Array<{ title: string; snippet: string; active?: boolean }>,
  ): Promise<{ upserted: number; deactivated: number }> {
    const botOid = new Types.ObjectId(botId);
    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'note' })
      .select('_id noteMeta')
      .lean();

    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { noteMeta?: { snippetIndex?: number; kind?: string } }).noteMeta;
      if (meta?.kind === 'snippet' && meta.snippetIndex != null) {
        byIndex.set(meta.snippetIndex, { _id: (item as { _id: Types.ObjectId })._id });
      }
    }

    let upserted = 0;
    for (let i = 0; i < snippets.length; i++) {
      const row = snippets[i];
      const stitle = (row.title ?? '').trim() || 'Snippet';
      const body = (row.snippet ?? '').trim();
      const active = row.active !== false;
      const hasContent = stitle.length > 0 && body.length > 0;
      const textForHash = buildNoteEmbeddingText(stitle, body);
      const hash = computeEmbeddingInputHash(textForHash);
      const content = textForHash;
      const rawPayload = hasContent ? JSON.stringify({ title: stitle, snippet: body }) : undefined;

      const noteMeta = { kind: 'snippet' as const, snippetIndex: i };

      const existing = byIndex.get(i);
      if (existing) {
        const current = await this.itemModel.findById(existing._id).select('contentHash').lean();
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        await this.itemModel.updateOne(
          { _id: existing._id },
          {
            $set: {
              title: stitle,
              content: hasContent ? content : '',
              contentHash: hash,
              noteMeta,
              rawContent: rawPayload,
              status: hasContent && active ? (sameHash ? 'ready' : 'queued') : 'ready',
              active: hasContent && active,
              updatedAt: new Date(),
            },
          },
        );
        upserted++;
        byIndex.delete(i);
        continue;
      }

      await this.itemModel.create({
        botId: botOid,
        title: stitle,
        sourceType: 'note',
        status: hasContent && active ? 'queued' : 'ready',
        active: hasContent && active,
        content: hasContent ? content : '',
        contentHash: hash,
        noteMeta,
        rawContent: rawPayload,
      });
      upserted++;
    }

    const deactivatedLegacy = await this.itemModel.updateMany(
      { botId: botOid, sourceType: 'note', 'noteMeta.kind': 'general_note' },
      { $set: { active: false, updatedAt: new Date() } },
    );
    const deactivated = await this.deactivateMissingSnippetKnowledgeItemsForBot(botId, snippets.length);
    return { upserted, deactivated: (deactivatedLegacy.modifiedCount ?? 0) + deactivated };
  }

  /**
   * Legacy: one blob note. Prefer {@link upsertSnippetKnowledgeItemsForBot} with a single entry.
   */
  async upsertNoteKnowledgeItemForBot(botId: string, knowledgeDescription: string): Promise<{ id: string; created: boolean; active: boolean }> {
    const text = (knowledgeDescription ?? '').trim();
    if (!text) {
      await this.deactivateNoteKnowledgeItemsForBot(botId);
      return { id: '', created: false, active: false };
    }
    return this.upsertSnippetKnowledgeItemsForBot(botId, [{ title: 'Notes', snippet: text, active: true }]).then(() => ({
      id: '',
      created: true,
      active: true,
    }));
  }

  /**
   * Deactivate note items with snippetIndex not in 0..count-1 (and any stray general_note is handled in upsert).
   */
  async deactivateMissingSnippetKnowledgeItemsForBot(botId: string, snippetCount: number): Promise<number> {
    const botOid = new Types.ObjectId(botId);
    const result = await this.itemModel.updateMany(
      { botId: botOid, sourceType: 'note', 'noteMeta.kind': 'snippet', 'noteMeta.snippetIndex': { $gte: snippetCount } },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  async deactivateNoteKnowledgeItemsForBot(botId: string): Promise<number> {
    const result = await this.itemModel.updateMany(
      { botId: new Types.ObjectId(botId), sourceType: 'note' },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  /**
   * Sync knowledge tables: one KnowledgeBaseItem per table (`sourceType: table`, `tableMeta.tableIndex`).
   */
  async upsertTableKnowledgeItemsForBot(
    botId: string,
    tables: Array<{
      title: string;
      columns: string[];
      rows: string[][];
      active?: boolean;
      importFileSize?: number;
      importFileName?: string;
    }>,
  ): Promise<{ upserted: number; deactivated: number }> {
    const botOid = new Types.ObjectId(botId);
    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'table' })
      .select('_id tableMeta')
      .lean();

    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { tableMeta?: { tableIndex?: number } }).tableMeta;
      if (meta?.tableIndex != null) byIndex.set(meta.tableIndex, { _id: (item as { _id: Types.ObjectId })._id });
    }

    let upserted = 0;
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]!;
      const title = (t.title ?? '').trim() || `Table ${i + 1}`;
      const columns = Array.isArray(t.columns) ? t.columns.map((c) => String(c ?? '')) : [];
      const rows = Array.isArray(t.rows) ? t.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [];
      const active = t.active !== false;
      const hasContent = columns.length > 0 && rows.length > 0;
      const textForHash = buildTableEmbeddingText(title, columns, rows);
      const hash = computeEmbeddingInputHash(textForHash);
      const content = textForHash;

      const tableMeta = { tableIndex: i };

      const existing = byIndex.get(i);
      if (existing) {
        const current = await this.itemModel
          .findById(existing._id)
          .select('contentHash sourceMeta')
          .lean();
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        const rawPayload = hasContent ? JSON.stringify({ title, columns, rows }) : undefined;
        const prevSm = (current as { sourceMeta?: KnowledgeBaseItemSourceMeta | null } | null)?.sourceMeta;
        const incomingSize = t.importFileSize;
        const incomingName = t.importFileName;
        const mergedSize =
          typeof incomingSize === 'number' && Number.isFinite(incomingSize) && incomingSize >= 0
            ? Math.min(Math.floor(incomingSize), MAX_DATASHEET_IMPORT_BYTES)
            : typeof prevSm?.fileSize === 'number' && Number.isFinite(prevSm.fileSize)
              ? Math.min(Math.floor(prevSm.fileSize), MAX_DATASHEET_IMPORT_BYTES)
              : undefined;
        const mergedName =
          typeof incomingName === 'string' && incomingName.trim()
            ? clampStr(incomingName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
            : typeof prevSm?.fileName === 'string' && prevSm.fileName.trim()
              ? clampStr(prevSm.fileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
              : undefined;
        const nextSourceMeta: KnowledgeBaseItemSourceMeta = {};
        if (mergedSize != null) nextSourceMeta.fileSize = mergedSize;
        if (mergedName) nextSourceMeta.fileName = mergedName;

        const $set: Record<string, unknown> = {
          title,
          content: hasContent ? content : '',
          contentHash: hash,
          tableMeta,
          status: hasContent && active ? (sameHash ? 'ready' : 'queued') : 'ready',
          active: hasContent && active,
          rawContent: rawPayload,
          updatedAt: new Date(),
        };
        if (Object.keys(nextSourceMeta).length > 0) {
          $set.sourceMeta = nextSourceMeta;
        }
        await this.itemModel.updateOne(
          { _id: existing._id },
          {
            $set: $set,
          },
        );
        upserted++;
        byIndex.delete(i);
        continue;
      }

      const rawNew = hasContent ? JSON.stringify({ title, columns, rows }) : undefined;
      const insSize = t.importFileSize;
      const insName = t.importFileName;
      const cSize =
        typeof insSize === 'number' && Number.isFinite(insSize) && insSize >= 0
          ? Math.min(Math.floor(insSize), MAX_DATASHEET_IMPORT_BYTES)
          : undefined;
      const cName =
        typeof insName === 'string' && insName.trim()
          ? clampStr(insName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
          : undefined;
      const newSourceMeta: KnowledgeBaseItemSourceMeta | undefined =
        cSize != null || cName
          ? { ...(cSize != null ? { fileSize: cSize } : {}), ...(cName ? { fileName: cName } : {}) }
          : undefined;

      await this.itemModel.create({
        botId: botOid,
        title,
        sourceType: 'table',
        status: hasContent && active ? 'queued' : 'ready',
        active: hasContent && active,
        content: hasContent ? content : '',
        contentHash: hash,
        tableMeta,
        rawContent: rawNew,
        ...(newSourceMeta ? { sourceMeta: newSourceMeta } : {}),
      });
      upserted++;
    }

    const deactivated = await this.deactivateMissingTableKnowledgeItemsForBot(botId, tables.length);
    return { upserted, deactivated };
  }

  async deactivateMissingTableKnowledgeItemsForBot(botId: string, tableCount: number): Promise<number> {
    const botOid = new Types.ObjectId(botId);
    const result = await this.itemModel.updateMany(
      { botId: botOid, sourceType: 'table', 'tableMeta.tableIndex': { $gte: tableCount } },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  async findKnowledgeItemsForBot(
    botId: string,
    options?: { sourceType?: 'document' | 'faq' | 'note' | 'url' | 'html' | 'table'; activeOnly?: boolean },
  ) {
    const filter: Record<string, unknown> = { botId: new Types.ObjectId(botId) };
    if (options?.sourceType) filter.sourceType = options.sourceType;
    if (options?.activeOnly !== false) filter.active = true;
    return this.itemModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  /** Get Q&A list for a bot from KB (for admin/chat display). */
  async getFaqsForBot(
    botId: string,
    options?: { includeInactive?: boolean },
  ): Promise<
    Array<{
      title?: string;
      questions: string[];
      question: string;
      answer: string;
      active?: boolean;
    }>
  > {
    const includeInactive = options?.includeInactive === true;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'faq',
        ...(includeInactive ? {} : { active: true }),
      })
      .select(includeInactive ? 'faqMeta active' : 'faqMeta')
      .sort({ 'faqMeta.faqIndex': 1 })
      .lean();
    return items.map((it) => {
      const meta = (it as {
        faqMeta?: {
          title?: string;
          questions?: string[];
          question?: string;
          answer?: string;
        };
        active?: boolean;
      }).faqMeta;
      const title = String(meta?.title ?? '').trim();
      const fromArr = Array.isArray(meta?.questions) ? meta!.questions!.map((q) => String(q ?? '').trim()).filter(Boolean) : [];
      const qSingle = String(meta?.question ?? '').trim();
      const questions = fromArr.length ? fromArr : qSingle ? [qSingle] : [];
      const question = questions[0] ?? '';
      return {
        ...(title ? { title } : {}),
        questions,
        question,
        answer: String(meta?.answer ?? '').trim(),
        active: includeInactive ? (it as { active?: boolean }).active !== false : true,
      };
    });
  }

  /**
   * Titled snippets for workspace UI (active rows). Legacy `general_note` becomes one synthetic snippet.
   */
  async getSnippetsForBot(
    botId: string,
    options?: { includeInactive?: boolean },
  ): Promise<Array<{ title: string; snippet: string; active?: boolean }>> {
    const includeInactive = options?.includeInactive === true;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'note',
        ...(includeInactive ? {} : { active: true }),
      })
      .select(includeInactive ? 'title content rawContent noteMeta active' : 'title content rawContent noteMeta')
      .sort({ 'noteMeta.snippetIndex': 1, createdAt: 1 })
      .lean() as Array<{
        title?: string;
        content?: string;
        rawContent?: string;
        noteMeta?: { kind?: string; snippetIndex?: number };
        active?: boolean;
      }>;

    const rows: Array<{ title: string; snippet: string; active?: boolean }> = [];
    for (const it of items) {
      const kind = it.noteMeta?.kind;
      if (kind === 'general_note') {
        const c = (it.content ?? '').trim();
        if (c) {
          rows.push({
            title: (it.title ?? '').trim() || 'Notes',
            snippet: c,
            active: includeInactive ? it.active !== false : true,
          });
        }
        continue;
      }
      if (kind !== 'snippet') continue;
      let body = '';
      if (it.rawContent) {
        try {
          const p = JSON.parse(it.rawContent) as { title?: string; snippet?: string };
          body = String(p.snippet ?? '').trim();
        } catch {
          body = (it.content ?? '').trim();
        }
      } else {
        body = (it.content ?? '').trim();
      }
      if (!body && !includeInactive) continue;
      const stitle = (it.title ?? '').trim() || 'Snippet';
      rows.push({
        title: stitle,
        snippet: body,
        active: includeInactive ? it.active !== false : true,
      });
    }
    return rows;
  }

  /**
   * Join all active snippet bodies for embed runtime `knowledgeDescription` compatibility.
   */
  async getNoteContentForBot(botId: string): Promise<string> {
    const list = await this.getSnippetsForBot(botId);
    return list
      .filter((r) => r.active !== false)
      .map((r) => r.snippet.trim())
      .filter(Boolean)
      .join('\n\n');
  }

  async getTablesForBot(
    botId: string,
    options?: { includeInactive?: boolean },
  ): Promise<Array<{ title: string; columns: string[]; rows: string[][]; active?: boolean }>> {
    const includeInactive = options?.includeInactive === true;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'table',
        ...(includeInactive ? {} : { active: true }),
      })
      .select(includeInactive ? 'title rawContent tableMeta active' : 'title rawContent tableMeta')
      .sort({ 'tableMeta.tableIndex': 1, createdAt: 1 })
      .lean();

    const out: Array<{ title: string; columns: string[]; rows: string[][]; active?: boolean }> = [];
    for (const it of items) {
      const ac = (it as { active?: boolean }).active;
      if (!includeInactive && ac === false) continue;
      const titleStored = (it as { title?: string }).title?.trim() || 'Table';
      const raw = (it as { rawContent?: string }).rawContent;
      if (raw && typeof raw === 'string') {
        try {
          const p = JSON.parse(raw) as { title?: string; columns?: string[]; rows?: string[][] };
          out.push({
            title: (p.title ?? titleStored).trim() || titleStored,
            columns: Array.isArray(p.columns) ? p.columns.map((c) => String(c ?? '')) : [],
            rows: Array.isArray(p.rows) ? p.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [],
            active: ac !== false,
          });
        } catch {
          out.push({ title: titleStored, columns: [], rows: [], active: ac !== false });
        }
      } else {
        out.push({ title: titleStored, columns: [], rows: [], active: ac !== false });
      }
    }
    return out;
  }

  /** KB-based status for admin (replaces legacy embedding job status). */
  async getKnowledgeStatusForBot(botId: string): Promise<{
    faqItemCount: number;
    noteContentLength: number;
    snippetItemCount: number;
    tableItemCount: number;
  }> {
    const [faqs, noteContent, snippets, tables] = await Promise.all([
      this.getFaqsForBot(botId),
      this.getNoteContentForBot(botId),
      this.getSnippetsForBot(botId),
      this.getTablesForBot(botId),
    ]);
    return {
      faqItemCount: faqs.length,
      noteContentLength: noteContent.length,
      snippetItemCount: snippets.length,
      tableItemCount: tables.length,
    };
  }

  async findKnowledgeItemById(id: string): Promise<KnowledgeBaseItem | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.itemModel.findById(new Types.ObjectId(id)).lean();
  }

  /** Find the document-linked KnowledgeBaseItem for a given document (for chunk sync). */
  async findKnowledgeItemByDocumentId(botId: string, documentId: string): Promise<{ _id: Types.ObjectId } | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) return null;
    const item = await this.itemModel
      .findOne({
        botId: new Types.ObjectId(botId),
        documentId: new Types.ObjectId(documentId),
        sourceType: 'document',
      })
      .select('_id')
      .lean();
    return item as { _id: Types.ObjectId } | null;
  }

  /**
   * Update status/active for the document-linked item (e.g. when document is set active/failed/queued).
   */
  async setDocumentKnowledgeItemStatus(
    botId: string,
    documentId: string,
    updates: { status?: 'queued' | 'processing' | 'ready' | 'failed'; active?: boolean },
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) return false;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status != null) set.status = updates.status;
    if (updates.active != null) set.active = updates.active;
    const result = await this.itemModel.updateOne(
      { botId: new Types.ObjectId(botId), documentId: new Types.ObjectId(documentId), sourceType: 'document' },
      { $set: set },
    );
    return (result.modifiedCount ?? 0) > 0;
  }

  /**
   * Deactivate KnowledgeBaseItems linked to the given document IDs (e.g. when documents are removed).
   */
  async deactivateByDocumentIds(botId: string, documentIds: Types.ObjectId[]): Promise<number> {
    if (documentIds.length === 0) return 0;
    const result = await this.itemModel.updateMany(
      { botId: new Types.ObjectId(botId), documentId: { $in: documentIds }, sourceType: 'document' },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  /**
   * Per-index training metadata for titled snippets (matches `knowledgeSnippets[i]` on the bot document).
   */
  async getIndexedSnippetTraining(
    botId: string,
    count: number,
  ): Promise<Array<{ trainingStatus: KnowledgeBaseItemStatus; lastTrainedAt: string | null } | null>> {
    if (count <= 0) {
      return [];
    }
    if (!Types.ObjectId.isValid(botId)) {
      return Array.from({ length: count }, () => null);
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'note',
        'noteMeta.kind': 'snippet',
      })
      .select('status processedAt noteMeta')
      .lean();
    const out: Array<{ trainingStatus: KnowledgeBaseItemStatus; lastTrainedAt: string | null } | null> = Array.from(
      { length: count },
      () => null,
    );
    for (const it of rows) {
      const idx = (it as { noteMeta?: { snippetIndex?: number; kind?: string } }).noteMeta?.snippetIndex;
      if (idx == null || idx < 0 || idx >= count) continue;
      const status = (it as { status?: KnowledgeBaseItemStatus }).status;
      if (!status) continue;
      const processedAt = (it as { processedAt?: Date }).processedAt;
      out[idx] = {
        trainingStatus: status,
        lastTrainedAt:
          processedAt instanceof Date ? processedAt.toISOString() : processedAt != null ? String(processedAt) : null,
      };
    }
    return out;
  }

  /**
   * Per-index training metadata for FAQs (matches `faqs[i]` on the bot document).
   */
  async getIndexedFaqTraining(
    botId: string,
    count: number,
  ): Promise<Array<{ trainingStatus: KnowledgeBaseItemStatus; lastTrainedAt: string | null } | null>> {
    if (count <= 0) {
      return [];
    }
    if (!Types.ObjectId.isValid(botId)) {
      return Array.from({ length: count }, () => null);
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'faq',
      })
      .select('status processedAt faqMeta')
      .lean();
    const out: Array<{ trainingStatus: KnowledgeBaseItemStatus; lastTrainedAt: string | null } | null> = Array.from(
      { length: count },
      () => null,
    );
    for (const it of rows) {
      const idx = (it as { faqMeta?: { faqIndex?: number } }).faqMeta?.faqIndex;
      if (idx == null || idx < 0 || idx >= count) continue;
      const status = (it as { status?: KnowledgeBaseItemStatus }).status;
      if (!status) continue;
      const processedAt = (it as { processedAt?: Date }).processedAt;
      out[idx] = {
        trainingStatus: status,
        lastTrainedAt:
          processedAt instanceof Date ? processedAt.toISOString() : processedAt != null ? String(processedAt) : null,
      };
    }
    return out;
  }

  /**
   * Per-index metadata for knowledge datasheets (matches `knowledgeDatasheets[i]` / `knowledgeTables[i]` on the bot).
   */
  async getIndexedTableTraining(
    botId: string,
    count: number,
  ): Promise<
    Array<{
      trainingStatus: KnowledgeBaseItemStatus;
      lastTrainedAt: string | null;
      importFileSize: number | null;
      importFileName: string | null;
    } | null>
  > {
    if (count <= 0) {
      return [];
    }
    if (!Types.ObjectId.isValid(botId)) {
      return Array.from({ length: count }, () => null);
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'table',
      })
      .select('status processedAt tableMeta sourceMeta')
      .lean();
    const out: Array<{
      trainingStatus: KnowledgeBaseItemStatus;
      lastTrainedAt: string | null;
      importFileSize: number | null;
      importFileName: string | null;
    } | null> = Array.from({ length: count }, () => null);
    for (const it of rows) {
      const idx = (it as { tableMeta?: { tableIndex?: number } }).tableMeta?.tableIndex;
      if (idx == null || idx < 0 || idx >= count) continue;
      const status = (it as { status?: KnowledgeBaseItemStatus }).status;
      if (!status) continue;
      const processedAt = (it as { processedAt?: Date }).processedAt;
      const sm = (it as { sourceMeta?: KnowledgeBaseItemSourceMeta | null }).sourceMeta;
      const fsz = sm?.fileSize;
      out[idx] = {
        trainingStatus: status,
        lastTrainedAt:
          processedAt instanceof Date ? processedAt.toISOString() : processedAt != null ? String(processedAt) : null,
        importFileSize: typeof fsz === 'number' && Number.isFinite(fsz) && fsz >= 0 ? fsz : null,
        importFileName: typeof sm?.fileName === 'string' && sm.fileName.trim() ? sm.fileName.trim() : null,
      };
    }
    return out;
  }
}
