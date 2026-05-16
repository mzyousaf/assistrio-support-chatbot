import { Types } from 'mongoose';
import { buildNoteEmbeddingText } from './faq-note-embedding.helper';
import { getUtf8ByteCount } from './knowledge-byte-size.util';
import {
  buildKnowledgeUsageWithLimit,
  calculateDocumentKnowledgeUsageBytes,
  calculateFaqKnowledgeUsageBytes,
  calculateKnowledgeUsageFromItems,
  calculateNoteKnowledgeUsageBytes,
  calculateSuggestionKnowledgeUsageBytes,
} from './knowledge-usage.util';
import type { KnowledgeBaseItemUsageLean } from './knowledge-usage.util';
import { KnowledgeUsageService } from './knowledge-usage.service';

describe('knowledge-usage.util', () => {
  describe('per-type UTF-8 byte sizing', () => {
    it('document uses actual UTF-8 bytes including emoji', () => {
      const s = 'hello 🙂';
      expect(calculateDocumentKnowledgeUsageBytes({ sourceType: 'document', content: s })).toBe(getUtf8ByteCount(s));
    });

    it('document falls back to characterCount when content missing', () => {
      expect(
        calculateDocumentKnowledgeUsageBytes({
          sourceType: 'document',
          content: '',
          characterCount: 1200,
        }),
      ).toBe(1200);
    });

    it('FAQ counts title, questions, and answer (Urdu multi-byte)', () => {
      const title = 'عنوان';
      const answer = 'جواب';
      const b = calculateFaqKnowledgeUsageBytes({
        sourceType: 'faq',
        faqMeta: { title, questions: ['سوال'], answer },
      });
      expect(b).toBeGreaterThan(title.length + answer.length);
    });

    it('snippet note counts title + body from rawContent JSON', () => {
      const raw = JSON.stringify({ title: 'T', snippet: 'body با' });
      const bytes = calculateNoteKnowledgeUsageBytes({
        sourceType: 'note',
        rawContent: raw,
        title: 'ignored',
      });
      expect(bytes).toBe(getUtf8ByteCount(buildNoteEmbeddingText('T', 'body با')));
    });
  });

  describe('aggregate calculateKnowledgeUsageFromItems', () => {
    const base = { active: true as const };

    it('sums table content + rawContent and importFileSize sum when present', () => {
      const items: KnowledgeBaseItemUsageLean[] = [
        {
          ...base,
          sourceType: 'table',
          content: 'a',
          rawContent: 'ب',
          tableMeta: { importPhase: 'complete', importFileSize: 5000 },
        },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.tableBytes).toBe(getUtf8ByteCount('a') + getUtf8ByteCount('ب'));
      expect(u.tableCount).toBe(1);
      expect(u.tableImportFileSizeBytesSum).toBe(5000);
    });

    it('suggestion with scopedInformation counts scoped UTF-8 only; label-only excluded', () => {
      const items: KnowledgeBaseItemUsageLean[] = [
        {
          ...base,
          sourceType: 'suggestion',
          suggestionMeta: { chipText: 'Chip', scopedInformation: 'Scope با' },
        },
        {
          ...base,
          sourceType: 'suggestion',
          suggestionMeta: { chipText: 'Only label' },
        },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.suggestionCount).toBe(1);
      expect(u.suggestionBytes).toBe(getUtf8ByteCount('Scope با'));
    });

    it('suggestion usage falls back to rawContent JSON context when meta missing', () => {
      const b = calculateSuggestionKnowledgeUsageBytes({
        sourceType: 'suggestion',
        suggestionMeta: { chipText: 'X' },
        rawContent: JSON.stringify({ label: 'X', context: 'fallback body' }),
      });
      expect(b).toBe(getUtf8ByteCount('fallback body'));
    });

    it('suggestion usage bytes ignore chip text length', () => {
      const scoped = 'same';
      const shortChip = calculateSuggestionKnowledgeUsageBytes({
        sourceType: 'suggestion',
        suggestionMeta: { chipText: 'A', scopedInformation: scoped },
      });
      const longChip = calculateSuggestionKnowledgeUsageBytes({
        sourceType: 'suggestion',
        suggestionMeta: { chipText: 'B'.repeat(500), scopedInformation: scoped },
      });
      expect(shortChip).toBe(longChip);
      expect(shortChip).toBe(getUtf8ByteCount(scoped));
    });

    it('ignores inactive and soft-deleted rows', () => {
      const items: KnowledgeBaseItemUsageLean[] = [
        { sourceType: 'note', content: 'x', active: false },
        { sourceType: 'note', content: 'y', active: true, deletedAt: new Date() },
        { sourceType: 'note', content: 'ok', active: true },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.noteCount).toBe(1);
      expect(u.noteBytes).toBe(getUtf8ByteCount(buildNoteEmbeddingText(undefined, 'ok')));
    });

    it('excludes table import in-flight and failed-without-grid', () => {
      const items: KnowledgeBaseItemUsageLean[] = [
        { ...base, sourceType: 'table', content: 'a', tableMeta: { importPhase: 'import_queued' } },
        { ...base, sourceType: 'table', content: '', rawContent: '', tableMeta: { importPhase: 'import_failed' } },
        { ...base, sourceType: 'table', content: 'z', tableMeta: { importPhase: 'complete' } },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.tableCount).toBe(1);
      expect(u.tableBytes).toBe(getUtf8ByteCount('z'));
    });

    it('excludes document multipart preview pending without keys', () => {
      const items: KnowledgeBaseItemUsageLean[] = [
        {
          ...base,
          sourceType: 'document',
          content: '',
          characterCount: 0,
          fileMeta: { uploadSessionId: 'sess-1', storageBucket: '', storageKey: '' },
        },
        { ...base, sourceType: 'document', content: 'done' },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.documentCount).toBe(1);
    });

    it('counts out_of_storage document in totalBytes; trainableBytes excludes it', () => {
      const limBody = 'x'.repeat(500);
      const items: KnowledgeBaseItemUsageLean[] = [
        {
          ...base,
          sourceType: 'document',
          content: limBody,
          isContentExtracted: true,
          extractionStatus: 'done',
          trainingError: 'plan_limit_bot_kb_total',
        },
        { ...base, sourceType: 'document', content: 'y', isContentExtracted: true, extractionStatus: 'done' },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.documentCount).toBe(2);
      expect(u.documentBytes).toBe(getUtf8ByteCount(limBody) + getUtf8ByteCount('y'));
      expect(u.totalBytes).toBe(u.documentBytes);
      expect(u.trainableBytes).toBe(getUtf8ByteCount('y'));
    });

    it('does not count soft-deleted out_of_storage document', () => {
      const body = 'z'.repeat(100);
      const items: KnowledgeBaseItemUsageLean[] = [
        {
          ...base,
          sourceType: 'document',
          content: body,
          isContentExtracted: true,
          extractionStatus: 'done',
          trainingError: 'plan_limit_bot_kb_total',
          deletedAt: new Date(),
        },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.documentCount).toBe(0);
      expect(u.totalBytes).toBe(0);
    });

    it('counts out_of_storage table grid in totalBytes; trainableBytes excludes it', () => {
      const grid = 't'.repeat(300);
      const items: KnowledgeBaseItemUsageLean[] = [
        {
          ...base,
          sourceType: 'table',
          content: grid,
          rawContent: '[]',
          tableMeta: { importPhase: 'complete' },
          trainingError: 'plan_limit_bot_kb_total',
        },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.tableCount).toBe(1);
      expect(u.totalBytes).toBe(getUtf8ByteCount(grid) + getUtf8ByteCount('[]'));
      expect(u.trainableBytes).toBe(0);
    });

    it('unknown sourceType uses content + rawContent fallback (html)', () => {
      const items: KnowledgeBaseItemUsageLean[] = [
        { ...base, sourceType: 'html', content: 'h', rawContent: 'r' },
      ];
      const u = calculateKnowledgeUsageFromItems(items);
      expect(u.otherBytes).toBe(getUtf8ByteCount('h') + getUtf8ByteCount('r'));
      expect(u.itemCount).toBe(1);
    });
  });

  describe('buildKnowledgeUsageWithLimit', () => {
    it('adds maxBytes, remainingBytes, percentUsed from bot config', () => {
      const maxBytes = 100_000_000;
      const forced = {
        ...calculateKnowledgeUsageFromItems([]),
        totalBytes: 25_000_000,
      };
      const u = buildKnowledgeUsageWithLimit(forced, {
        botConfig: {
          knowledgeSize: { type: 'paid_addon', baseMaxBytes: 0, extraMaxBytes: 0, maxBytes },
        },
      });
      expect(u.maxBytes).toBe(maxBytes);
      expect(u.remainingBytes).toBe(75_000_000);
      expect(u.percentUsed).toBe(25);
    });

    it('allows percentUsed over 100 when stored total exceeds maxBytes', () => {
      const maxBytes = 50_000_000;
      const forced = {
        ...calculateKnowledgeUsageFromItems([]),
        totalBytes: 55_000_000,
        trainableBytes: 40_000_000,
      };
      const u = buildKnowledgeUsageWithLimit(forced, {
        botConfig: {
          knowledgeSize: { type: 'paid_addon', baseMaxBytes: 0, extraMaxBytes: 0, maxBytes },
        },
      });
      expect(u.percentUsed).toBeGreaterThan(100);
      expect(u.remainingBytes).toBeLessThan(0);
    });

    it('omits limit fields when bot is absent', () => {
      const u = buildKnowledgeUsageWithLimit(
        { ...calculateKnowledgeUsageFromItems([]), maxBytes: 1, remainingBytes: 1, percentUsed: 1 },
        undefined,
      );
      expect(u.maxBytes).toBeUndefined();
      expect(u.remainingBytes).toBeUndefined();
      expect(u.percentUsed).toBeUndefined();
    });
  });
});

describe('KnowledgeUsageService', () => {
  it('loads lean rows and returns aggregated usage', async () => {
    const oid = new Types.ObjectId();
    const leanRows = [
      { sourceType: 'faq', active: true, faqMeta: { title: 'T', questions: ['Q'], answer: 'A' } },
    ];
    const lean = jest.fn().mockResolvedValue(leanRows);
    const select = jest.fn().mockReturnValue({ lean });
    const find = jest.fn().mockReturnValue({ select });
    const model = { find } as unknown as import('mongoose').Model<unknown>;
    const svc = new KnowledgeUsageService(model as never);
    const out = await svc.getActiveBotKnowledgeUsage(oid, undefined);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: expect.any(Types.ObjectId),
        $and: expect.any(Array),
      }),
    );
    expect(String(find.mock.calls[0][0].botId)).toBe(String(oid));
    expect(out.faqCount).toBe(1);
    expect(out.totalBytes).toBeGreaterThan(0);
  });
});
