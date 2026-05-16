import { describe, expect, it } from '@jest/globals';
import { resolveCustomerDocumentPresentationNames } from './customer-document-presentation.util';

describe('resolveCustomerDocumentPresentationNames', () => {
  it('fallback order title → originalName → fileMeta.filename → sourceMeta.originalName → Untitled', () => {
    const r = {
      title: '',
      fileMeta: { filename: 'alpha.pdf', originalName: '' },
      sourceMeta: { originalName: 'beta.pdf' },
    };
    const o = resolveCustomerDocumentPresentationNames(r);
    expect(o.displayName.endsWith('.pdf')).toBe(true);
    expect(o.originalFilename?.includes('alpha')).toBe(true);
    expect(o.titleHeadline).toBe('alpha.pdf');
  });

  it('uses title first when provided', () => {
    const o = resolveCustomerDocumentPresentationNames({
      title: 'Quarterly Overview',
      fileMeta: { originalName: 'q.pdf', filename: 'ignored.pdf' },
    });
    expect(o.titleHeadline).toBe('Quarterly Overview');
    expect(o.displayName).toBe('Quarterly Overview');
  });

  it('Untitled document when nothing else resolves', () => {
    expect(resolveCustomerDocumentPresentationNames({}).titleHeadline).toBe('Untitled document');
  });
});
