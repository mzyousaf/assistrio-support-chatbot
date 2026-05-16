import { describe, expect, it } from 'vitest';
import type { CustomerKnowledgeStatusItem } from '@/api/types';
import {
  filterKnowledgeStatusItemsBySection,
  findCachedKnowledgeStatusItemForPoll,
  itemKnowledgePollNeedsItemScopedRefresh,
  knowledgeSectionsForWorkspaceBotRefresh,
  mergeKnowledgeStatusItemsPatchSectionRows,
} from './knowledgeStatusPollUtils';

describe('knowledgeSectionsForWorkspaceBotRefresh', () => {
  it('prefers explicit affectedSections (single document does not imply faq/note/table/suggestion refresh)', () => {
    expect(
      knowledgeSectionsForWorkspaceBotRefresh({
        affectedSections: ['document'],
        registeredSectionKeys: ['faq', 'note', 'table', 'suggestion'],
        pathname: '/bots/x/playground/knowledgebase/faqs',
      }),
    ).toEqual(['document']);
  });

  it('falls back to registered poll sections when affectedSections omitted', () => {
    expect(
      knowledgeSectionsForWorkspaceBotRefresh({
        registeredSectionKeys: ['faq', 'document'],
        pathname: '/outside/knowledgebase',
      }),
    ).toEqual(['document', 'faq']);
  });

  it('uses pathname when nothing registered', () => {
    expect(
      knowledgeSectionsForWorkspaceBotRefresh({
        registeredSectionKeys: [],
        pathname: '/bots/1/playground/knowledgebase/snippets',
      }),
    ).toEqual(['note']);
  });

  it('does not fan out typed status refreshes outside the knowledge base route', () => {
    expect(
      knowledgeSectionsForWorkspaceBotRefresh({
        registeredSectionKeys: [],
        pathname: '/bots/1/playground/translation',
      }),
    ).toEqual([]);
  });
});

describe('findCachedKnowledgeStatusItemForPoll', () => {
  it('returns the row matching id and section', () => {
    const row: CustomerKnowledgeStatusItem = {
      id: 'abc',
      sourceType: 'note',
      status: 'ready',
    };
    expect(findCachedKnowledgeStatusItemForPoll([row], 'note', 'abc')).toEqual(row);
    expect(findCachedKnowledgeStatusItemForPoll([row], 'note', 'missing')).toBeNull();
  });
});

describe('itemKnowledgePollNeedsItemScopedRefresh', () => {
  it('is false for idle pending / training_required-style rows', () => {
    const row: CustomerKnowledgeStatusItem = {
      id: 'x',
      sourceType: 'note',
      status: 'pending',
      displayStatus: 'training_required',
      isTraining: false,
    };
    expect(itemKnowledgePollNeedsItemScopedRefresh(row, 'note')).toBe(false);
  });

  it('is true for queued / processing / in-flight flags', () => {
    expect(
      itemKnowledgePollNeedsItemScopedRefresh(
        { id: 'a', sourceType: 'note', status: 'queued', isTraining: false },
        'note',
      ),
    ).toBe(true);
    expect(
      itemKnowledgePollNeedsItemScopedRefresh(
        { id: 'b', sourceType: 'note', status: 'processing', isTraining: true },
        'note',
      ),
    ).toBe(true);
    expect(
      itemKnowledgePollNeedsItemScopedRefresh(
        { id: 'c', sourceType: 'document', status: 'ready', isExtracting: true },
        'document',
      ),
    ).toBe(true);
    expect(
      itemKnowledgePollNeedsItemScopedRefresh(
        { id: 'd', sourceType: 'table', status: 'pending', isImporting: true },
        'table',
      ),
    ).toBe(true);
  });

  it('is true for document extraction pipeline and upload display', () => {
    expect(
      itemKnowledgePollNeedsItemScopedRefresh(
        {
          id: 'e',
          sourceType: 'document',
          status: 'pending',
          extractionStatus: 'queued',
        },
        'document',
      ),
    ).toBe(true);
    expect(
      itemKnowledgePollNeedsItemScopedRefresh(
        {
          id: 'f',
          sourceType: 'document',
          status: 'pending',
          displayStatus: 'uploading',
        },
        'document',
      ),
    ).toBe(true);
  });
});

describe('mergeKnowledgeStatusItemsPatchSectionRows', () => {
  it('fills sourceType from the request section when the API omits it so filters still match', () => {
    const row: CustomerKnowledgeStatusItem = {
      id: '69fda8e23da293e907c0942f',
      status: 'ready',
      displayLabel: 'Trained',
    };
    const merged = mergeKnowledgeStatusItemsPatchSectionRows(null, 'suggestion', [row]);
    const slice = filterKnowledgeStatusItemsBySection(merged, 'suggestion');
    expect(slice).toHaveLength(1);
    expect(slice[0]?.sourceType).toBe('suggestion');
    expect(slice[0]?.id).toBe(row.id);
  });
});
