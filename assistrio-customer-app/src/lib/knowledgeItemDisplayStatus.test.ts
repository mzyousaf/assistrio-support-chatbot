import { describe, expect, it } from 'vitest';
import { getKnowledgeItemDisplayStatus, getKnowledgeItemReplyUsageLabel } from './knowledgeItemDisplayStatus';

describe('getKnowledgeItemReplyUsageLabel', () => {
  it('maps active:false → Not used in replies', () => {
    expect(getKnowledgeItemReplyUsageLabel(false)).toBe('Not used in replies');
  });

  it('maps active:true or undefined → Used in replies', () => {
    expect(getKnowledgeItemReplyUsageLabel(true)).toBe('Used in replies');
    expect(getKnowledgeItemReplyUsageLabel(undefined)).toBe('Used in replies');
  });
});

describe('getKnowledgeItemDisplayStatus (training lifecycle only)', () => {
  it('queued + isTraining:true still shows Training Queued, not Training', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      status: 'queued',
      isTraining: true,
    });
    expect(r.label).toBe('Training Queued');
    expect(r.dotCanon).toBe('queued');
  });

  it('processing maps to Training', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      status: 'processing',
    });
    expect(r.label).toBe('Training');
    expect(r.dotCanon).toBe('processing');
  });

  it('ready maps to Trained', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      status: 'ready',
    });
    expect(r.label).toBe('Trained');
    expect(r.dotCanon).toBe('ready');
  });

  it('failed maps to Training Failed', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      status: 'failed',
    });
    expect(r.label).toBe('Training Failed');
    expect(r.dotCanon).toBe('failed');
  });

  it('active:false does not override ready', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      active: false,
      status: 'ready',
    });
    expect(r.label).toBe('Trained');
    expect(r.dotCanon).toBe('ready');
  });

  it('active:false + queued still shows Training Queued', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      active: false,
      status: 'queued',
      displayLabel: 'Scheduled',
    });
    expect(r.dotCanon).toBe('queued');
    expect(r.label).toBe('Training Queued');
  });

  it('active:false + pending still shows Training Required', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      active: false,
      status: 'pending',
    });
    expect(r.dotCanon).toBe('pending');
    expect(r.label).toBe('Training Required');
  });

  it('document: extraction processing + status ready → Extracting', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      active: false,
      status: 'ready',
      extractionStatus: 'processing',
      isContentExtracted: false,
    });
    expect(r.label).toBe('Extracting');
    expect(r.dotCanon).toBe('processing');
  });

  it('document: pending + no text yet + no extraction row → Extracting (not Training Required)', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'pending',
      isContentExtracted: false,
    });
    expect(r.label).toBe('Extracting');
    expect(r.dotCanon).toBe('processing');
  });

  it('document: pending + content extracted → Training Required', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'pending',
      isContentExtracted: true,
    });
    expect(r.label).toBe('Training Required');
    expect(r.dotCanon).toBe('pending');
  });

  it('document: pending + content extracted + auto train → Training Queued', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'pending',
      isContentExtracted: true,
      autoTrainEnabled: true,
    });
    expect(r.label).toBe('Training Queued');
    expect(r.dotCanon).toBe('queued');
  });

  it('document: queued + text extracted → Training Queued', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'queued',
      isContentExtracted: true,
    });
    expect(r.label).toBe('Training Queued');
    expect(r.dotCanon).toBe('queued');
  });

  it('document: queued + no text yet → Extracting', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'queued',
      isContentExtracted: false,
    });
    expect(r.label).toBe('Extracting');
    expect(r.dotCanon).toBe('processing');
  });

  it('document: pending + characterCount only → Training Required', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'pending',
      isContentExtracted: false,
      characterCount: 120,
    });
    expect(r.label).toBe('Training Required');
    expect(r.dotCanon).toBe('pending');
  });

  it('document: uploadStatus uploaded, no text, no extract row → Uploaded', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'pending',
      uploadStatus: 'uploaded',
      isContentExtracted: false,
    });
    expect(r.label).toBe('Uploaded');
    expect(r.dotCanon).toBe('pending');
  });

  it('document: pipeline pending_extraction, no text → Uploaded', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'pending',
      isContentExtracted: false,
      documentPipelineStage: 'pending_extraction',
    });
    expect(r.label).toBe('Uploaded');
  });

  it('document: pipeline extract_queued, no text → Extracting', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'pending',
      isContentExtracted: false,
      documentPipelineStage: 'extract_queued',
    });
    expect(r.label).toBe('Extracting');
    expect(r.dotCanon).toBe('processing');
  });

  it('document: pipeline uploading without uploadStatus → Uploading', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'document',
      status: 'uploading',
      documentPipelineStage: 'uploading',
    });
    expect(r.label).toBe('Uploading');
    expect(r.dotCanon).toBe('processing');
  });

  it('table: active:false + importing still shows Importing', () => {
    const r = getKnowledgeItemDisplayStatus({
      sourceType: 'table',
      active: false,
      status: 'pending',
      displayStatus: 'import_queued',
    });
    expect(r.label).toBe('Importing');
    expect(r.dotCanon).toBe('processing');
  });
});
