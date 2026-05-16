import { HttpException } from '@nestjs/common';
import { DEFAULT_KB_FIELD_LIMITS } from '../../knowledge/knowledge-plan-limits';
import {
  normalizeBotPayload,
  normalizeWorkspaceBotPatch,
  normalizeWorkspaceKnowledgeFaqsArray,
  normalizeWorkspaceKnowledgeSnippetsArray,
} from './bot-payload';

describe('normalizeWorkspaceBotPatch — KB section UTF-8 plan limits', () => {
  const L = DEFAULT_KB_FIELD_LIMITS;

  it('does not throw when unrelated keys are patched', () => {
    expect(() => normalizeWorkspaceBotPatch({ name: 'Hello' })).not.toThrow();
  });

  it('rejects faqs on bot PATCH (use /knowledge/faqs/:index)', () => {
    expect(() =>
      normalizeWorkspaceBotPatch({
        faqs: [{ title: 't', questions: ['q'], answer: 'a', active: true }],
      }),
    ).toThrow(HttpException);
  });

  it('throws when faqs title exceeds UTF-8 byte cap via dedicated FAQ normalizer', () => {
    const title = 'x'.repeat(L.faqTitleMaxBytes + 1);
    expect(() =>
      normalizeWorkspaceKnowledgeFaqsArray([{ title, questions: ['q'], answer: 'a', active: true }]),
    ).toThrow(HttpException);
  });

  it('throws when knowledgeSnippets body exceeds cap via dedicated snippet normalizer', () => {
    const snippet = 's'.repeat(L.snippetDescriptionMaxBytes + 1);
    expect(() =>
      normalizeWorkspaceKnowledgeSnippetsArray([{ title: 'T', snippet, active: true }]),
    ).toThrow(HttpException);
  });

  it('treats label as snippet title when title is absent', () => {
    expect(
      normalizeWorkspaceKnowledgeSnippetsArray([{ label: 'Shelf life', snippet: '90 days fridge.', active: true }]),
    ).toEqual([{ title: 'Shelf life', snippet: '90 days fridge.', active: true }]);
  });

  it('normalizeBotPayload enforces the same FAQ caps', () => {
    const title = 'x'.repeat(L.faqTitleMaxBytes + 1);
    expect(() =>
      normalizeBotPayload({
        name: 'Bot',
        faqs: [{ title, questions: ['q'], answer: 'a', active: true }],
      } as Record<string, unknown>),
    ).toThrow(HttpException);
  });
});
