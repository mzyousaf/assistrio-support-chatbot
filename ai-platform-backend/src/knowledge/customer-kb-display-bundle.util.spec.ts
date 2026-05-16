import { describe, expect, it } from '@jest/globals';
import {
  deriveCustomerKbItemApiDisplayBundle,
  finalizeCustomerKbItemApiDisplayBundle,
  deriveKnowledgeBaseItemDisplayFields,
} from './knowledge-item-display-status.util';

describe('deriveCustomerKbItemApiDisplayBundle', () => {
  it('document extraction processing maps customer label Extracting text', () => {
    const b = deriveCustomerKbItemApiDisplayBundle({
      sourceType: 'document',
      status: 'pending',
      extractionStatus: 'processing',
      isContentExtracted: false,
      content: '',
      fileMeta: {},
    });
    expect(b.displayStatus).toBe('extracting_text');
    expect(b.displayLabel).toBe('Extracting text');
    expect(b.isExtracting).toBe(true);
    expect(b.isTraining).toBe(false);
  });

  it('table job processing maps to Importing customer label', () => {
    const b = deriveCustomerKbItemApiDisplayBundle({
      sourceType: 'table',
      status: 'pending',
      extractionStatus: 'not_required',
      tableImportPhase: 'import_queued',
      tableImportJobStatus: 'processing',
    });
    expect(b.displayStatus).toBe('importing');
    expect(b.displayLabel).toBe('Importing');
    expect(b.isImporting).toBe(true);
  });

  it('plan_limit_bot_kb_total maps to Out of storage before generic failed workflow', () => {
    const wf = deriveKnowledgeBaseItemDisplayFields({
      sourceType: 'document',
      status: 'failed',
      extractionStatus: 'done',
      isContentExtracted: true,
      content: 'body',
      trainingError: 'plan_limit_bot_kb_total',
    });
    expect(wf.displayStatus).toBe('out_of_storage');
    const b = finalizeCustomerKbItemApiDisplayBundle(wf, {
      sourceType: 'document',
      status: 'failed',
    });
    expect(b.displayStatus).toBe('out_of_storage');
    expect(b.displayLabel).toBe('Out of storage');
  });

  it('FAQ embedding queued vs processing separates display labels', () => {
    const q = finalizeCustomerKbItemApiDisplayBundle(
      { displayStatus: 'training_queued', displayMessage: 'Training Queued…' },
      { sourceType: 'faq', status: 'queued' },
    );
    expect(q.displayStatus).toBe('training');
    expect(q.displayLabel).toBe('Training Queued');

    const p = finalizeCustomerKbItemApiDisplayBundle(
      { displayStatus: 'training', displayMessage: 'Training…' },
      { sourceType: 'faq', status: 'processing' },
    );
    expect(p.displayStatus).toBe('training');
    expect(p.displayLabel).toBe('Training');
  });

  it('generic lifecycle failed (no plan limit) maps to failed customer taxonomy', () => {
    const b = deriveCustomerKbItemApiDisplayBundle({
      sourceType: 'faq',
      status: 'failed',
    });
    expect(b.displayStatus).toBe('failed');
    expect(b.displayLabel).toBe('Failed');
  });
});
