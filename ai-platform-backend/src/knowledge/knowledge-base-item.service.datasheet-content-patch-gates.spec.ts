import { HttpException, HttpStatus } from '@nestjs/common';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';

describe('KnowledgeBaseItemService.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch', () => {
  function svcWithFindLean(row: Record<string, unknown> | null) {
    const lean = jest.fn().mockResolvedValue(row);
    const select = jest.fn().mockReturnValue({ lean });
    const findOne = jest.fn().mockReturnValue({ select });
    const instance = Object.create(KnowledgeBaseItemService.prototype) as {
      itemModel: { findOne: typeof findOne };
      assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch: KnowledgeBaseItemService['assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch'];
    };
    instance.itemModel = { findOne };
    instance.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch =
      KnowledgeBaseItemService.prototype.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch;
    return { instance, findOne };
  }

  async function expectConflict(
    run: () => Promise<unknown>,
    errorCode: 'kb_table_import_busy' | 'datasheet_training_busy',
  ) {
    try {
      await run();
      throw new Error('expected HttpException');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const he = e as HttpException;
      expect(he.getStatus()).toBe(HttpStatus.CONFLICT);
      const body = he.getResponse() as Record<string, unknown>;
      expect(body.errorCode).toBe(errorCode);
    }
  }

  it('throws kb_table_import_busy when import_queued (before training check)', async () => {
    const { instance } = svcWithFindLean({
      status: 'queued',
      tableMeta: { importPhase: 'import_queued' },
    });
    await expectConflict(
      () => instance.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch('665f8dd44f6f58de4012ab12', [0]),
      'kb_table_import_busy',
    );
  });

  it('throws kb_table_import_busy when importing', async () => {
    const { instance } = svcWithFindLean({
      status: 'ready',
      tableMeta: { importPhase: 'importing' },
    });
    await expectConflict(
      () => instance.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch('665f8dd44f6f58de4012ab12', [1]),
      'kb_table_import_busy',
    );
  });

  it('throws datasheet_training_busy when status is queued', async () => {
    const { instance } = svcWithFindLean({
      status: 'queued',
      tableMeta: {},
    });
    await expectConflict(
      () => instance.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch('665f8dd44f6f58de4012ab12', [0]),
      'datasheet_training_busy',
    );
  });

  it('throws datasheet_training_busy when status is processing', async () => {
    const { instance } = svcWithFindLean({
      status: 'processing',
      tableMeta: {},
    });
    await expectConflict(
      () => instance.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch('665f8dd44f6f58de4012ab12', [0]),
      'datasheet_training_busy',
    );
  });

  it('allows pending and ready', async () => {
    for (const status of ['pending', 'ready'] as const) {
      const { instance } = svcWithFindLean({ status, tableMeta: {} });
      await expect(
        instance.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch('665f8dd44f6f58de4012ab12', [0]),
      ).resolves.toBeUndefined();
    }
  });

  it('no-ops when row is missing', async () => {
    const { instance } = svcWithFindLean(null);
    await expect(
      instance.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch('665f8dd44f6f58de4012ab12', [0]),
    ).resolves.toBeUndefined();
  });
});
