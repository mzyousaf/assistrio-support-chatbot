import { HttpException, HttpStatus } from '@nestjs/common';
import { BotsService } from './bots.service';

describe('BotsService.patchWorkspaceBotKnowledgeTableAtIndex datasheet gates', () => {
  const botId = '665f8dd44f6f58de4012ab12';

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
      {} as never,
    );
  }

  const baseTable = { title: 'Catalog', columns: ['A'], rows: [['1']], active: true };

  it('content patch while training busy throws datasheet_training_busy and does not upsert', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([{ ...baseTable }]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest
        .fn()
        .mockRejectedValue(
          new HttpException(
            {
              error:
                'This datasheet is being trained. Please wait until training finishes before editing rows.',
              errorCode: 'datasheet_training_busy',
            },
            HttpStatus.CONFLICT,
          ),
        ),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await expect(svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { rows: [['1'], ['2']] })).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).not.toHaveBeenCalled();
  });

  it('content patch while processing throws via gate and does not upsert', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([{ ...baseTable }]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest
        .fn()
        .mockRejectedValue(
          new HttpException(
            { error: 'busy', errorCode: 'datasheet_training_busy' },
            HttpStatus.CONFLICT,
          ),
        ),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await expect(
      svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { rows: [['x']] }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).not.toHaveBeenCalled();
  });

  it('row delete (smaller grid) skips bot KB total limit assert', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([
        {
          title: 'Catalog',
          columns: ['A', 'B'],
          rows: [
            ['1', '2'],
            ['3', '4'],
          ],
          active: true,
        },
      ]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest.fn().mockResolvedValue(undefined),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { rows: [['1', '2']] });

    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).toHaveBeenCalledWith(botId, expect.any(Array), {
      skipKbTotalLimitAssert: true,
    });
  });

  it('row add runs default limit assert when UTF-8 table section size increases', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([{ ...baseTable }]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest.fn().mockResolvedValue(undefined),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { rows: [['1'], ['2']] });

    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).toHaveBeenCalledWith(
      botId,
      expect.any(Array),
      undefined,
    );
  });

  it('row edit with longer cell runs default limit assert', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([{ ...baseTable }]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest.fn().mockResolvedValue(undefined),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { rows: [['longer']] });

    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).toHaveBeenCalledWith(
      botId,
      expect.any(Array),
      undefined,
    );
  });

  it('row edit with shorter cell skips limit assert', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([{ title: 'Catalog', columns: ['A'], rows: [['hello']], active: true }]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest.fn().mockResolvedValue(undefined),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { rows: [['a']] });

    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).toHaveBeenCalledWith(botId, expect.any(Array), {
      skipKbTotalLimitAssert: true,
    });
  });

  it('active-only patch skips busy gate and limit assert', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([{ ...baseTable }]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest.fn().mockResolvedValue(undefined),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { active: false });

    expect(knowledgeBaseItemService.assertWorkspaceBotPatchKnowledgeTrainingGates).not.toHaveBeenCalled();
    expect(knowledgeBaseItemService.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch).not.toHaveBeenCalled();
    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).toHaveBeenCalledWith(botId, expect.any(Array), {
      skipKbTotalLimitAssert: true,
    });
  });

  it('content patch invokes datasheet busy gate for patched index only', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest
        .fn()
        .mockResolvedValue([
          { ...baseTable, title: 'T0' },
          { title: 'T1', columns: ['B'], rows: [['x']], active: true },
        ]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest.fn().mockResolvedValue(undefined),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 2, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 1, { rows: [['y']] });

    expect(knowledgeBaseItemService.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch).toHaveBeenCalledWith(
      botId,
      [1],
    );
  });

  it('inactive table content patch still enforces training busy gate', async () => {
    const knowledgeBaseItemService = {
      getTablesForBot: jest.fn().mockResolvedValue([{ ...baseTable, active: false }]),
      assertWorkspaceBotPatchKnowledgeTrainingGates: jest.fn().mockResolvedValue(undefined),
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: jest
        .fn()
        .mockRejectedValue(
          new HttpException(
            { error: 'busy', errorCode: 'datasheet_training_busy' },
            HttpStatus.CONFLICT,
          ),
        ),
      upsertTableKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 1, deactivated: 0 }),
    };
    const svc = makeService(knowledgeBaseItemService);

    await expect(svc.patchWorkspaceBotKnowledgeTableAtIndex(botId, 0, { rows: [['z']] })).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).not.toHaveBeenCalled();
  });
});
