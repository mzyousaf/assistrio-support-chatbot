import {
  documentKbContentFingerprint,
  normalizeKbDocumentBodyForHash,
  normalizeKbDocumentTitleForRow,
} from './knowledge-content-hash.util';
import { kbDocumentManualPatchIsNoop } from './kb-document-manual-patch.util';

describe('kbDocumentManualPatchIsNoop', () => {
  it('detects noop when fingerprint and active match', () => {
    const title = 'My doc';
    const text = 'Body line';
    const t = normalizeKbDocumentTitleForRow(title);
    const b = normalizeKbDocumentBodyForHash(text);
    const hash = documentKbContentFingerprint(t, b);
    expect(
      kbDocumentManualPatchIsNoop({ contentHash: hash, active: true }, title, text, true),
    ).toBe(true);
  });

  it('false when title changes (included in fingerprint)', () => {
    const title = 'My doc';
    const text = 'Body line';
    const t = normalizeKbDocumentTitleForRow(title);
    const b = normalizeKbDocumentBodyForHash(text);
    const hash = documentKbContentFingerprint(t, b);
    expect(kbDocumentManualPatchIsNoop({ contentHash: hash, active: true }, `${title}!`, text, true)).toBe(false);
  });

  it('false when body changes', () => {
    const title = 'My doc';
    const text = 'Body line';
    const hash = documentKbContentFingerprint(normalizeKbDocumentTitleForRow(title), normalizeKbDocumentBodyForHash(text));
    expect(kbDocumentManualPatchIsNoop({ contentHash: hash, active: true }, title, `${text}\nextra`, true)).toBe(
      false,
    );
  });

  it('stable to object key insertion order irrelevant (uses fingerprint only)', () => {
    const title = 'T';
    const text = 'A';
    const hash = documentKbContentFingerprint(
      normalizeKbDocumentTitleForRow(title),
      normalizeKbDocumentBodyForHash(text),
    );
    expect(kbDocumentManualPatchIsNoop({ contentHash: hash, active: true }, title, text, true)).toBe(true);
  });

  it('detects inclusion toggle-only change', () => {
    const title = 'Doc';
    const text = 'X';
    const hash = documentKbContentFingerprint(
      normalizeKbDocumentTitleForRow(title),
      normalizeKbDocumentBodyForHash(text),
    );
    expect(kbDocumentManualPatchIsNoop({ contentHash: hash, active: true }, title, text, false)).toBe(false);
    expect(kbDocumentManualPatchIsNoop({ contentHash: hash, active: false }, title, text, true)).toBe(false);
  });

  it('false when kb is null', () => {
    expect(kbDocumentManualPatchIsNoop(null, 't', 'b', true)).toBe(false);
  });
});
