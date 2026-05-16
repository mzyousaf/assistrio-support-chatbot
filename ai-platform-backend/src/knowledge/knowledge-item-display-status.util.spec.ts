import {
  customerFacingKnowledgeTrainingStatus,
  deriveKnowledgeBaseItemDisplayFields,
} from './knowledge-item-display-status.util';

describe('deriveKnowledgeBaseItemDisplayFields', () => {
  it('maps document extraction + training pairs per spec', () => {
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'queued',
        extractionStatus: 'waiting_for_source',
      }).displayStatus,
    ).toBe('waiting_for_source');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'pending',
        extractionStatus: 'queued',
      }).displayStatus,
    ).toBe('waiting_to_extract');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'pending',
        extractionStatus: 'processing',
      }).displayStatus,
    ).toBe('extracting_text');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'pending',
        extractionStatus: 'failed',
      }).displayStatus,
    ).toBe('extraction_failed');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'pending',
        extractionStatus: 'done',
        isContentExtracted: true,
        content: 'hello world',
      }).displayStatus,
    ).toBe('waiting_for_training');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'queued',
        extractionStatus: 'done',
        isContentExtracted: true,
        content: 'hello world',
      }).displayStatus,
    ).toBe('training_queued');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'processing',
        extractionStatus: 'done',
        isContentExtracted: true,
        content: 'hello world',
      }).displayStatus,
    ).toBe('training');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'ready',
        extractionStatus: 'done',
        isContentExtracted: true,
        content: 'hello world',
      }).displayStatus,
    ).toBe('ready');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'failed',
        extractionStatus: 'done',
        isContentExtracted: true,
        content: 'hello world',
      }).displayStatus,
    ).toBe('training_failed');
  });

  it('uses training lifecycle only for non-documents', () => {
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'faq',
        status: 'pending',
      }).displayStatus,
    ).toBe('waiting_for_training');
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'faq',
        status: 'failed',
      }).displayStatus,
    ).toBe('training_failed');
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'faq',
        status: 'failed',
        trainingError: 'plan_limit_bot_kb_total',
      }).displayStatus,
    ).toBe('out_of_storage');
  });

  it('uses table import phase before generic training status', () => {
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'table',
        status: 'failed',
        extractionStatus: 'not_required',
        tableImportPhase: 'import_queued',
      }).displayStatus,
    ).toBe('import_queued');
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'table',
        status: 'pending',
        extractionStatus: 'not_required',
        tableImportPhase: 'importing',
      }).displayStatus,
    ).toBe('importing_table');
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'table',
        status: 'pending',
        extractionStatus: 'not_required',
        tableImportPhase: 'import_failed',
      }).displayStatus,
    ).toBe('import_failed');
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'table',
        status: 'pending',
        extractionStatus: 'not_required',
        tableImportPhase: 'import_queued',
        tableImportJobStatus: 'processing',
      }).displayStatus,
    ).toBe('importing_table');

    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'table',
        status: 'pending',
        extractionStatus: 'not_required',
        tableImportPhase: 'complete',
      }).displayStatus,
    ).toBe('waiting_for_training');
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'table',
        status: 'failed',
        extractionStatus: 'not_required',
        tableImportPhase: 'complete',
      }).displayStatus,
    ).toBe('training_failed');
  });

  it('maps plan limit to out_of_storage for documents', () => {
    const r = deriveKnowledgeBaseItemDisplayFields({
      sourceType: 'document',
      status: 'failed',
      extractionStatus: 'done',
      isContentExtracted: true,
      content: 'x',
      trainingError: 'plan_limit_bot_kb_total',
    });
    expect(r.displayStatus).toBe('out_of_storage');
    expect(r.displayMessage).toContain('knowledge limit');
    expect(r.displayMessage).toContain('buy more storage');
  });

  it('maps table import failure with plan limit code to out_of_storage', () => {
    const r = deriveKnowledgeBaseItemDisplayFields({
      sourceType: 'table',
      status: 'pending',
      extractionStatus: 'not_required',
      tableImportPhase: 'import_failed',
      importErrorCode: 'plan_limit_bot_kb_total',
    });
    expect(r.displayStatus).toBe('out_of_storage');
  });

  it('customerFacingKnowledgeTrainingStatus returns import lifecycle aliases', () => {
    expect(
      customerFacingKnowledgeTrainingStatus({
        workflowDisplayStatus: 'out_of_storage',
        lifecycleStatus: 'failed',
      }),
    ).toBe('out_of_storage');
    expect(
      customerFacingKnowledgeTrainingStatus({
        workflowDisplayStatus: 'import_queued',
        lifecycleStatus: 'pending',
      }),
    ).toBe('import_queued');
    expect(
      customerFacingKnowledgeTrainingStatus({
        workflowDisplayStatus: 'importing_table',
        lifecycleStatus: 'pending',
      }),
    ).toBe('importing_table');
  });

  it('maps document upload progress to uploading workflow', () => {
    expect(
      deriveKnowledgeBaseItemDisplayFields({
        sourceType: 'document',
        status: 'pending',
        extractionStatus: 'waiting_for_source',
        uploadDocumentStatus: 'uploading',
      }).displayStatus,
    ).toBe('uploading');
  });
});

