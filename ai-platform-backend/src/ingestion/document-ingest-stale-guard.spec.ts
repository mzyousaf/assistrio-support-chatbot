import {
  documentIngestKbContentFingerprint,
  shouldSkipDocumentKnowledgeChunkWrite,
  timesRoughlyEqualContentUpdate,
} from './document-ingest-stale-guard';
import {
  computeKnowledgeContentHash,
  documentKbContentFingerprint,
  normalizeKbDocumentBodyForHash,
} from '../knowledge/knowledge-content-hash.util';

describe('document-ingest-stale-guard', () => {
  it('documentIngestKbContentFingerprint matches knowledge base document hash', () => {
    const title = 'Hello';
    const text = 'body';
    const expected = computeKnowledgeContentHash(`${title}\n${text}`);
    expect(documentIngestKbContentFingerprint(title, text)).toBe(expected);
    expect(documentIngestKbContentFingerprint(title, text)).toBe(documentKbContentFingerprint(title, text));
  });

  it('trims document title in fingerprint (naive untrimmed title hash differs)', () => {
    const naive = computeKnowledgeContentHash('  Spaced  \nbody');
    const fp = documentIngestKbContentFingerprint('  Spaced  ', 'body');
    expect(fp).not.toBe(naive);
    expect(fp).toBe(computeKnowledgeContentHash('Spaced\nbody'));
  });

  it('stale_document_text does not requeue (train-only cannot repair hash≠fingerprint drift)', () => {
    const t = new Date('2024-06-01T12:00:00.000Z');
    const wrongHash = computeKnowledgeContentHash('other');
    const doc = { title: 'My doc', text: 'hello', active: true };
    const kb = { active: true, contentHash: wrongHash, lastContentUpdatedAt: t };
    const snap = { kbContentHash: wrongHash, kbLastContentUpdatedAt: t };
    const r = shouldSkipDocumentKnowledgeChunkWrite(doc, kb, snap);
    expect(r.skip).toBe(true);
    if (r.skip) {
      expect(r.reason).toBe('stale_document_text');
      expect(r.requeueLater).toBe(false);
      expect(r.clearStuckProcessing).toBe(false);
    }
  });

  it('skips when document was deleted', () => {
    const snap = { kbContentHash: 'abc', kbLastContentUpdatedAt: new Date('2020-01-01') };
    const r = shouldSkipDocumentKnowledgeChunkWrite(null, { contentHash: 'abc', active: true }, snap);
    expect(r.skip).toBe(true);
    if (r.skip) expect(r.reason).toBe('document_deleted');
  });

  it('skips when KB content hash changed (concurrent update)', () => {
    const t = new Date('2024-06-01T12:00:00.000Z');
    const snap = {
      kbContentHash: computeKnowledgeContentHash('t\nold'),
      kbLastContentUpdatedAt: t,
    };
    const latestDoc = { title: 't', text: 'new', active: true };
    const kb = {
      active: true,
      contentHash: computeKnowledgeContentHash('t\nnew'),
      lastContentUpdatedAt: t,
    };
    const r = shouldSkipDocumentKnowledgeChunkWrite(latestDoc, kb, snap);
    expect(r.skip).toBe(true);
    if (r.skip) expect(r.reason).toBe('stale_kb_content_hash');
  });

  it('allows write when snapshot matches latest doc and KB row', () => {
    const t = new Date('2024-06-01T12:00:00.000Z');
    const h = computeKnowledgeContentHash('My doc\nhello');
    const doc = { title: 'My doc', text: 'hello', active: true };
    const kb = { active: true, contentHash: h, lastContentUpdatedAt: t };
    const snap = { kbContentHash: h, kbLastContentUpdatedAt: t };
    const r = shouldSkipDocumentKnowledgeChunkWrite(doc, kb, snap);
    expect(r.skip).toBe(false);
  });

  it('allows write for spaced title + CRLF body (matches KB row + queue snapshot contract)', () => {
    const t = new Date('2024-06-01T12:00:00.000Z');
    const title = '  My doc  ';
    const rawBody = 'hello\r\nworld';
    const h = documentKbContentFingerprint(title, rawBody);
    const docTextNorm = normalizeKbDocumentBodyForHash(rawBody);
    const doc = { title, text: docTextNorm, active: true };
    const kb = { active: true, contentHash: h, lastContentUpdatedAt: t };
    const snap = { kbContentHash: h, kbLastContentUpdatedAt: t };
    expect(h).toBe(documentKbContentFingerprint('My doc', docTextNorm));
    expect(shouldSkipDocumentKnowledgeChunkWrite(doc, kb, snap).skip).toBe(false);
  });

  it('queue-time snapshot hash equals fingerprint from KB title + stored normalized content', () => {
    const title = '  Doc  ';
    const raw = 'a\r\n\r\nb';
    const embedSnapHash = documentKbContentFingerprint(title, raw);
    const storedContent = normalizeKbDocumentBodyForHash(raw);
    const fpAtQueue = documentKbContentFingerprint(title, storedContent);
    expect(fpAtQueue).toBe(embedSnapHash);
  });

  it('does not skip as stale_document_text when hash and lastContentUpdatedAt match (status-only paths must not bump content version)', () => {
    const t = new Date('2024-06-01T12:00:00.000Z');
    const h = documentKbContentFingerprint('Stable', 'body');
    const doc = { title: 'Stable', text: normalizeKbDocumentBodyForHash('body'), active: true };
    const kb = { active: true, contentHash: h, lastContentUpdatedAt: t };
    const snap = { kbContentHash: h, kbLastContentUpdatedAt: t };
    const r = shouldSkipDocumentKnowledgeChunkWrite(doc, kb, snap);
    expect(r.skip).toBe(false);
  });

  it('does not skip when use-in-replies is off (`active:false`) — training still persists chunks', () => {
    const t = new Date('2024-06-01T12:00:00.000Z');
    const h = computeKnowledgeContentHash('My doc\nhello');
    const doc = { title: 'My doc', text: 'hello', active: false };
    const kb = { active: false, contentHash: h, lastContentUpdatedAt: t };
    const snap = { kbContentHash: h, kbLastContentUpdatedAt: t };
    expect(shouldSkipDocumentKnowledgeChunkWrite(doc, kb, snap).skip).toBe(false);
  });

  it('timesRoughlyEqualContentUpdate matches same instant', () => {
    const d = new Date('2020-01-02T03:04:05.006Z');
    expect(timesRoughlyEqualContentUpdate(d, d)).toBe(true);
    expect(timesRoughlyEqualContentUpdate(null, null)).toBe(true);
  });
});
