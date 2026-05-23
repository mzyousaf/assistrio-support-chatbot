import { BotsService } from './bots.service';

describe('BotsService KB edit patch preserves inactive active=false', () => {
  function makeService(knowledgeBaseItemService: Record<string, unknown>) {
    return new BotsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      knowledgeBaseItemService as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('inactive FAQ edit keeps active:false', async () => {
    const knowledgeBaseItemService = {
      getFaqsForBot: jest.fn().mockResolvedValue([
        { title: 'Shipping', questions: ['When?'], answer: 'Old answer', active: false },
      ]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      upsertFaqKnowledgeItemsForBot: jest.fn().mockResolvedValue(undefined),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeFaqAtIndex('665f8dd44f6f58de4012ab12', 0, { answer: 'New answer' });

    const upsertArg = knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot.mock.calls[0]?.[1];
    expect(upsertArg?.[0]?.answer).toBe('New answer');
    expect(upsertArg?.[0]?.active).toBe(false);
  });

  it('inactive snippet edit keeps active:false', async () => {
    const knowledgeBaseItemService = {
      getSnippetsForBot: jest.fn().mockResolvedValue([
        { title: 'Returns', snippet: 'Old snippet', active: false },
      ]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      upsertSnippetKnowledgeItemsForBot: jest.fn().mockResolvedValue(undefined),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeSnippetAtIndex('665f8dd44f6f58de4012ab12', 0, { snippet: 'New snippet' });

    const upsertArg = knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot.mock.calls[0]?.[1];
    expect(upsertArg?.[0]?.snippet).toBe('New snippet');
    expect(upsertArg?.[0]?.active).toBe(false);
  });

  it('inactive table edit keeps active:false', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([
        { title: 'Catalog', columns: ['sku'], rows: [['A']], active: false },
      ]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest.fn().mockResolvedValue(undefined),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue(undefined),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeTableAtIndex('665f8dd44f6f58de4012ab12', 0, { rows: [['B']] });

    const upsertArg = knowledgeBaseItemService.upsertTableKnowledgeItemsForBot.mock.calls[0]?.[1];
    expect(upsertArg?.[0]?.rows).toEqual([['B']]);
    expect(upsertArg?.[0]?.active).toBe(false);
  });
});
