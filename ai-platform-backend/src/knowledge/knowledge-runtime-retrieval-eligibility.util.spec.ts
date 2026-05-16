import { knowledgeBaseItemEligibleForRuntimeRetrieval, knowledgeRuntimeRetrievalMatchParts } from './knowledge-runtime-retrieval-eligibility.util';
import { knowledgeItemNotDeletedClause } from './knowledge-base-item-access.service';

describe('knowledgeRuntimeRetrievalMatchParts', () => {
  it('includes not-deleted, ready, and document vs non-document extraction arms', () => {
    const parts = knowledgeRuntimeRetrievalMatchParts();
    expect(parts).toContainEqual(knowledgeItemNotDeletedClause());
    expect(parts).toContainEqual({ status: 'ready' });
    const extractionArm = parts.find((p) => '$or' in p) as { $or: unknown[] };
    expect(extractionArm.$or).toHaveLength(2);
  });
});

describe('knowledgeBaseItemEligibleForRuntimeRetrieval', () => {
  const readyDoc = {
    active: true,
    status: 'ready' as const,
    sourceType: 'document' as const,
    extractionStatus: 'done' as const,
    isContentExtracted: true,
  };

  it('rejects document when active=false (reply exclusion, not soft-delete)', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        ...readyDoc,
        active: false,
      }),
    ).toBe(false);
  });

  it('rejects document when deletedAt is set', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        ...readyDoc,
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });

  it('rejects document when extraction is queued', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        ...readyDoc,
        extractionStatus: 'queued',
      }),
    ).toBe(false);
  });

  it('rejects document when isContentExtracted is not true', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        ...readyDoc,
        isContentExtracted: false,
      }),
    ).toBe(false);
  });

  it('rejects FAQ when active=false', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        active: false,
        status: 'ready',
        sourceType: 'faq',
        extractionStatus: 'not_required',
      }),
    ).toBe(false);
  });

  it('rejects table when deletedAt set', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        active: true,
        status: 'ready',
        sourceType: 'table',
        extractionStatus: 'not_required',
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });

  it('rejects table when active=false (RAG exclusion; training may still run)', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        active: false,
        status: 'ready',
        sourceType: 'table',
        extractionStatus: 'not_required',
      }),
    ).toBe(false);
  });

  it('rejects unknown sourceType', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        active: true,
        status: 'ready',
        sourceType: 'other',
        extractionStatus: 'not_required',
      } as unknown as Parameters<typeof knowledgeBaseItemEligibleForRuntimeRetrieval>[0]),
    ).toBe(false);
  });

  it('accepts ready document with done extraction', () => {
    expect(knowledgeBaseItemEligibleForRuntimeRetrieval(readyDoc)).toBe(true);
  });

  it('accepts legacy document when extractionStatus omitted but content extracted', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        active: true,
        status: 'ready',
        sourceType: 'document',
        isContentExtracted: true,
      }),
    ).toBe(true);
  });

  it('accepts FAQ with not_required', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        active: true,
        status: 'ready',
        sourceType: 'faq',
        extractionStatus: 'not_required',
      }),
    ).toBe(true);
  });

  it('toggling active off excludes item, toggling back on re-allows ready item without lifecycle changes', () => {
    const base = {
      active: true,
      status: 'ready' as const,
      sourceType: 'note' as const,
      extractionStatus: 'not_required' as const,
    };
    expect(knowledgeBaseItemEligibleForRuntimeRetrieval(base)).toBe(true);
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        ...base,
        active: false,
      }),
    ).toBe(false);
    expect(knowledgeBaseItemEligibleForRuntimeRetrieval(base)).toBe(true);
  });

  it('rejects when status is not ready', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        ...readyDoc,
        status: 'failed',
      }),
    ).toBe(false);
  });

  it('rejects suggestion when reply-excluded (active false)', () => {
    expect(
      knowledgeBaseItemEligibleForRuntimeRetrieval({
        active: false,
        status: 'ready',
        sourceType: 'suggestion',
        extractionStatus: 'not_required',
      }),
    ).toBe(false);
  });
});
