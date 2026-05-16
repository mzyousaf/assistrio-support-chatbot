import { describe, expect, it } from 'vitest';
import type { CustomerAgentTrainingStatusResponse } from '@/api/types';
import {
  shouldPollAnyKnowledgeSectionFromAgentTrainingStatus,
  shouldPollKnowledgeSectionFromAgentTrainingStatus,
} from './knowledgeSectionStatusPollGate';

function ds(
  partial: Partial<CustomerAgentTrainingStatusResponse['dataSources'][number]> & {
    key: CustomerAgentTrainingStatusResponse['dataSources'][number]['key'];
  },
): CustomerAgentTrainingStatusResponse['dataSources'][number] {
  return {
    trainingRequired: 0,
    trainingQueued: 0,
    inTraining: 0,
    trained: 0,
    failed: 0,
    total: 0,
    ...partial,
  };
}

describe('shouldPollKnowledgeSectionFromAgentTrainingStatus', () => {
  it('is false when snapshot is null', () => {
    expect(shouldPollKnowledgeSectionFromAgentTrainingStatus(null, 'faq')).toBe(false);
  });

  it('is true when bucket has trainingQueued or inTraining', () => {
    const ts: CustomerAgentTrainingStatusResponse = {
      status: 'trained',
      label: '',
      isTraining: false,
      training_queued: false,
      isTextExtracting: false,
      isExtracting: false,
      isImporting: false,
      isTrained: true,
      needsTraining: false,
      hasFailed: false,
      counts: { pending: 0, queued: 0, processing: 0, ready: 1, failed: 0, total: 1 },
      characters: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      estimatedTrainingSeconds: 0,
      estimatedLabel: '',
      dataSources: [
        ds({ key: 'documents', total: 1 }),
        ds({ key: 'qna', total: 1 }),
        ds({ key: 'snippets', total: 1 }),
        ds({ key: 'datasheets', trainingQueued: 1, total: 1 }),
        ds({ key: 'suggestions', total: 1 }),
      ],
      knowledgeUsage: {} as CustomerAgentTrainingStatusResponse['knowledgeUsage'],
    };
    expect(shouldPollKnowledgeSectionFromAgentTrainingStatus(ts, 'table')).toBe(true);
    expect(shouldPollKnowledgeSectionFromAgentTrainingStatus(ts, 'faq')).toBe(false);
  });

  it('document section respects isExtracting', () => {
    const base = {
      status: 'trained' as const,
      label: '',
      isTraining: false,
      training_queued: false,
      isTextExtracting: true,
      isExtracting: false,
      isImporting: false,
      isTrained: true,
      needsTraining: false,
      hasFailed: false,
      counts: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      characters: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      estimatedTrainingSeconds: 0,
      estimatedLabel: '',
      dataSources: [
        ds({ key: 'documents', total: 0 }),
        ds({ key: 'qna', total: 0 }),
        ds({ key: 'snippets', total: 0 }),
        ds({ key: 'datasheets', total: 0 }),
        ds({ key: 'suggestions', total: 0 }),
      ],
      knowledgeUsage: {} as CustomerAgentTrainingStatusResponse['knowledgeUsage'],
    };
    expect(shouldPollKnowledgeSectionFromAgentTrainingStatus(base, 'document')).toBe(true);
  });

  it('document section polls when lifecycleCounts.extractingCount is positive (even if flags omit)', () => {
    const ts: CustomerAgentTrainingStatusResponse = {
      status: 'trained',
      label: '',
      isTraining: false,
      training_queued: false,
      isTextExtracting: false,
      isExtracting: false,
      isImporting: false,
      isTrained: true,
      needsTraining: false,
      hasFailed: false,
      counts: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      characters: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      estimatedTrainingSeconds: 0,
      estimatedLabel: '',
      lifecycleCounts: {
        extractingCount: 1,
        extractionFailedCount: 0,
        datasheetImportPipelineCount: 0,
        trainingQueuedCount: 0,
        trainingProcessingCount: 0,
        trainingFailedCount: 0,
        readyCount: 0,
      },
      dataSources: [
        ds({ key: 'documents', total: 0 }),
        ds({ key: 'qna', total: 0 }),
        ds({ key: 'snippets', total: 0 }),
        ds({ key: 'datasheets', total: 0 }),
        ds({ key: 'suggestions', total: 0 }),
      ],
      knowledgeUsage: {} as CustomerAgentTrainingStatusResponse['knowledgeUsage'],
    };
    expect(shouldPollKnowledgeSectionFromAgentTrainingStatus(ts, 'document')).toBe(true);
  });

  it('table section polls when lifecycleCounts.datasheetImportPipelineCount is positive', () => {
    const ts: CustomerAgentTrainingStatusResponse = {
      status: 'trained',
      label: '',
      isTraining: false,
      training_queued: false,
      isTextExtracting: false,
      isExtracting: false,
      isImporting: false,
      isTrained: true,
      needsTraining: false,
      hasFailed: false,
      counts: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      characters: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      estimatedTrainingSeconds: 0,
      estimatedLabel: '',
      lifecycleCounts: {
        extractingCount: 0,
        extractionFailedCount: 0,
        datasheetImportPipelineCount: 1,
        trainingQueuedCount: 0,
        trainingProcessingCount: 0,
        trainingFailedCount: 0,
        readyCount: 0,
      },
      dataSources: [
        ds({ key: 'documents', total: 0 }),
        ds({ key: 'qna', total: 0 }),
        ds({ key: 'snippets', total: 0 }),
        ds({ key: 'datasheets', total: 0 }),
        ds({ key: 'suggestions', total: 0 }),
      ],
      knowledgeUsage: {} as CustomerAgentTrainingStatusResponse['knowledgeUsage'],
    };
    expect(shouldPollKnowledgeSectionFromAgentTrainingStatus(ts, 'table')).toBe(true);
  });

  it('table section respects isImporting', () => {
    const ts: CustomerAgentTrainingStatusResponse = {
      status: 'trained',
      label: '',
      isTraining: false,
      training_queued: false,
      isTextExtracting: false,
      isExtracting: false,
      isImporting: true,
      isTrained: true,
      needsTraining: false,
      hasFailed: false,
      counts: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      characters: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      estimatedTrainingSeconds: 0,
      estimatedLabel: '',
      dataSources: [
        ds({ key: 'documents', total: 0 }),
        ds({ key: 'qna', total: 0 }),
        ds({ key: 'snippets', total: 0 }),
        ds({ key: 'datasheets', total: 0 }),
        ds({ key: 'suggestions', total: 0 }),
      ],
      knowledgeUsage: {} as CustomerAgentTrainingStatusResponse['knowledgeUsage'],
    };
    expect(shouldPollKnowledgeSectionFromAgentTrainingStatus(ts, 'table')).toBe(true);
  });
});

describe('shouldPollAnyKnowledgeSectionFromAgentTrainingStatus', () => {
  it('is false when all sections idle', () => {
    const ts: CustomerAgentTrainingStatusResponse = {
      status: 'trained',
      label: '',
      isTraining: false,
      training_queued: false,
      isTextExtracting: false,
      isExtracting: false,
      isImporting: false,
      isTrained: true,
      needsTraining: false,
      hasFailed: false,
      counts: { pending: 0, queued: 0, processing: 0, ready: 1, failed: 0, total: 1 },
      characters: { pending: 0, queued: 0, processing: 0, ready: 0, failed: 0, total: 0 },
      estimatedTrainingSeconds: 0,
      estimatedLabel: '',
      dataSources: [
        ds({ key: 'documents', total: 1 }),
        ds({ key: 'qna', total: 1 }),
        ds({ key: 'snippets', total: 1 }),
        ds({ key: 'datasheets', total: 1 }),
        ds({ key: 'suggestions', total: 1 }),
      ],
      knowledgeUsage: {} as CustomerAgentTrainingStatusResponse['knowledgeUsage'],
    };
    expect(shouldPollAnyKnowledgeSectionFromAgentTrainingStatus(ts)).toBe(false);
  });
});
