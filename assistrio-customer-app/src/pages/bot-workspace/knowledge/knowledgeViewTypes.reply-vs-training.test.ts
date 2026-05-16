import { describe, expect, it } from 'vitest';
import type { CustomerKnowledgeStatusItem } from '@/api/types';
import { kbDetailLifecyclePresentationFromPollRow } from './knowledgeViewTypes';

describe('kbDetailLifecyclePresentationFromPollRow', () => {
  it('shows Trained when poll is ready even if bot embed is stale (Use in replies off)', () => {
    const poll = {
      id: 'kid',
      status: 'ready',
      active: false,
      displayStatus: 'ready',
      displayLabel: 'Trained',
      displayMessage: '',
    } as unknown as CustomerKnowledgeStatusItem;
    const p = kbDetailLifecyclePresentationFromPollRow({
      sourceType: 'faq',
      active: false,
      poll,
      row: { trainingStatus: 'pending' },
    });
    expect(p.label).toBe('Trained');
    expect(p.dotCanon).toBe('ready');
  });

  it('shows Trained for inactive suggestion when API returns full trained row (user payload shape)', () => {
    const poll = {
      id: '69ffbf3b06c800dec4de17d6',
      sourceType: 'suggestion',
      active: false,
      status: 'ready',
      trainingStatus: 'ready',
      extractionStatus: 'not_required',
      lastQueuedAt: '2026-05-10T00:09:07.057Z',
      runAfter: '2026-05-10T00:09:37.057Z',
      lastTrainingStartedAt: '2026-05-10T00:09:42.777Z',
      lastTrainedAt: '2026-05-10T00:09:46.323Z',
      trainingError: null,
      extractionError: null,
      displayStatus: 'trained',
      displayLabel: 'Trained',
      displayMessage: 'Ready',
      isTraining: false,
      isExtracting: false,
      isImporting: false,
      trainingManualRetrySuggested: false,
      suggestionIndex: 0,
    } as unknown as CustomerKnowledgeStatusItem;
    const p = kbDetailLifecyclePresentationFromPollRow({
      sourceType: 'suggestion',
      active: false,
      poll,
      row: { trainingStatus: 'pending' },
    });
    expect(p.label).toBe('Trained');
    expect(p.dotCanon).toBe('ready');
  });

  it('keeps training label when Use in Replies is off but item is ready', () => {
    const poll = {
      id: 'kid',
      status: 'ready',
      active: false,
      displayStatus: 'ready',
      displayLabel: 'Trained',
      displayMessage: '',
    } as unknown as CustomerKnowledgeStatusItem;
    const p = kbDetailLifecyclePresentationFromPollRow({
      sourceType: 'faq',
      active: false,
      poll,
      row: { trainingStatus: 'ready' },
    });
    expect(p.label).toBe('Trained');
    expect(p.dotCanon).toBe('ready');
  });

  it('shows Trained when poll is done but bot embed is still pending (active suggestion / FAQ)', () => {
    const poll = {
      id: 'kid',
      status: 'ready',
      active: true,
      isTraining: false,
      displayStatus: 'trained',
      displayLabel: 'Trained',
      displayMessage: 'Ready',
    } as unknown as CustomerKnowledgeStatusItem;
    const p = kbDetailLifecyclePresentationFromPollRow({
      sourceType: 'suggestion',
      active: true,
      poll,
      row: { trainingStatus: 'pending' },
    });
    expect(p.label).toBe('Trained');
    expect(p.dotCanon).toBe('ready');
  });

  it('shows Trained when primary poll status is ready but display/trainingStatus still look action-needed', () => {
    const poll = {
      id: 'kid',
      status: 'ready',
      trainingStatus: 'pending',
      active: true,
      isTraining: false,
      displayStatus: 'training_required',
      displayLabel: 'Training required',
      displayMessage: 'Waiting for training…',
    } as unknown as CustomerKnowledgeStatusItem;
    const p = kbDetailLifecyclePresentationFromPollRow({
      sourceType: 'note',
      active: true,
      poll,
      row: { trainingStatus: 'pending' },
    });
    expect(p.label).toBe('Trained');
    expect(p.dotCanon).toBe('ready');
  });
});
