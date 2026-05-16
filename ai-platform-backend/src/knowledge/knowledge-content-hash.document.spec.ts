import {
  computeKnowledgeContentHash,
  documentKbContentFingerprint,
  normalizeKbDocumentBodyForHash,
  normalizeKbDocumentTitleForRow,
} from './knowledge-content-hash.util';

describe('knowledge-content-hash document KB alignment', () => {
  it('normalizes CRLF and collapses spaces like extraction path', () => {
    const raw = 'line1\r\nline2  spaced\r\n\r\n\r\npara2';
    expect(normalizeKbDocumentBodyForHash(raw)).toBe('line1\nline2 spaced\n\npara2');
  });

  it('document fingerprint matches hash of title\\n+normalized body', () => {
    const title = '  My doc  ';
    const body = 'a\r\nb';
    const fp = documentKbContentFingerprint(title, body);
    expect(fp).toBe(computeKnowledgeContentHash('My doc\na\nb'));
  });

  it('empty title becomes Document for row helper', () => {
    expect(normalizeKbDocumentTitleForRow('')).toBe('Document');
    expect(normalizeKbDocumentTitleForRow('   ')).toBe('Document');
    expect(normalizeKbDocumentTitleForRow('  x  ')).toBe('x');
  });

  it('fingerprint is stable for already-normalized body', () => {
    const body = 'a\nb';
    expect(documentKbContentFingerprint('t', body)).toBe(documentKbContentFingerprint('t', normalizeKbDocumentBodyForHash(body)));
  });
});
