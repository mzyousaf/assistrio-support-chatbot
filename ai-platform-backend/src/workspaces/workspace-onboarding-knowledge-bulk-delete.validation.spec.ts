import { BadRequestException } from '@nestjs/common';
import {
  ONBOARDING_KNOWLEDGE_BULK_DELETE_MAX_IDS,
  parseOnboardingKnowledgeBulkDeleteBody,
} from './workspace-onboarding-knowledge-bulk-delete.validation';

describe('parseOnboardingKnowledgeBulkDeleteBody', () => {
  it('accepts a non-empty ids array', () => {
    expect(parseOnboardingKnowledgeBulkDeleteBody({ ids: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('deduplicates ids', () => {
    expect(parseOnboardingKnowledgeBulkDeleteBody({ ids: ['a', 'a', 'b'] })).toEqual(['a', 'b']);
  });

  it('rejects empty ids array', () => {
    expect(() => parseOnboardingKnowledgeBulkDeleteBody({ ids: [] })).toThrow(BadRequestException);
  });

  it('rejects missing ids', () => {
    expect(() => parseOnboardingKnowledgeBulkDeleteBody({})).toThrow(BadRequestException);
  });

  it('rejects too many ids', () => {
    const ids = Array.from({ length: ONBOARDING_KNOWLEDGE_BULK_DELETE_MAX_IDS + 1 }, (_, i) => String(i));
    expect(() => parseOnboardingKnowledgeBulkDeleteBody({ ids })).toThrow(BadRequestException);
  });

  it('rejects blank ids only', () => {
    expect(() => parseOnboardingKnowledgeBulkDeleteBody({ ids: ['', '  '] })).toThrow(BadRequestException);
  });
});
