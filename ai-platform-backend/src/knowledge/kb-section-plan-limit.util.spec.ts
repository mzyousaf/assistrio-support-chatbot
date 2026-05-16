import { HttpException } from '@nestjs/common';
import { DEFAULT_KB_FIELD_LIMITS } from './knowledge-plan-limits';
import { getUtf8ByteCount } from './knowledge-byte-size.util';
import {
  assertFaqsWithinPlanLimits,
  assertSnippetsWithinPlanLimits,
  assertSuggestionsWithinPlanLimits,
} from './kb-section-plan-limit.util';

describe('kb-section-plan-limit.util', () => {
  const L = DEFAULT_KB_FIELD_LIMITS;

  describe('assertFaqsWithinPlanLimits', () => {
    it('allows FAQ questions splitting the combined byte cap', () => {
      const q1 = 'b'.repeat(400);
      const q2 = 'c'.repeat(600);
      expect(() =>
        assertFaqsWithinPlanLimits([{ title: 't', questions: [q1, q2], answer: 'a', active: true }]),
      ).not.toThrow();
    });

    it('allows FAQ exactly at field limits', () => {
      const title = 'a'.repeat(L.faqTitleMaxBytes);
      const q = 'b'.repeat(L.faqQuestionMaxBytes);
      const answer = 'c'.repeat(Math.min(200, L.faqAnswerMaxBytes));
      expect(() =>
        assertFaqsWithinPlanLimits([
          { title, questions: [q], answer, active: true },
        ]),
      ).not.toThrow();
    });

    it('rejects FAQ title one byte over limit', () => {
      const title = 'x'.repeat(L.faqTitleMaxBytes + 1);
      expect(() =>
        assertFaqsWithinPlanLimits([{ title, questions: ['q'], answer: 'a', active: true }]),
      ).toThrow(HttpException);
      try {
        assertFaqsWithinPlanLimits([{ title, questions: ['q'], answer: 'a', active: true }]);
      } catch (e) {
        const r = (e as HttpException).getResponse() as { errorCode?: string };
        expect(r.errorCode).toBe('plan_limit_faq_title_size');
      }
    });

    it('rejects FAQ when combined question UTF-8 exceeds cap', () => {
      const q1 = 'y'.repeat(500);
      const q2 = 'z'.repeat(501);
      expect(() =>
        assertFaqsWithinPlanLimits([{ title: 't', questions: [q1, q2], answer: 'ans', active: true }]),
      ).toThrow(HttpException);
      try {
        assertFaqsWithinPlanLimits([{ title: 't', questions: [q1, q2], answer: 'ans', active: true }]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_faq_question_size',
        );
      }
    });

    it('rejects single FAQ question over combined cap', () => {
      const q = 'y'.repeat(L.faqQuestionMaxBytes + 1);
      expect(() =>
        assertFaqsWithinPlanLimits([{ title: 't', questions: [q], answer: 'ans', active: true }]),
      ).toThrow(HttpException);
      try {
        assertFaqsWithinPlanLimits([{ title: 't', questions: [q], answer: 'ans', active: true }]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_faq_question_size',
        );
      }
    });

    it('rejects FAQ answer over limit', () => {
      const answer = 'z'.repeat(L.faqAnswerMaxBytes + 1);
      expect(() =>
        assertFaqsWithinPlanLimits([{ title: 't', questions: ['q'], answer, active: true }]),
      ).toThrow(HttpException);
      try {
        assertFaqsWithinPlanLimits([{ title: 't', questions: ['q'], answer, active: true }]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_faq_answer_size',
        );
      }
    });

    it('rejects combined FAQ total over section cap', () => {
      const chunk = 600_000;
      const answer = 'a'.repeat(chunk);
      expect(() =>
        assertFaqsWithinPlanLimits([
          { title: 't1', questions: ['q1'], answer, active: true },
          { title: 't2', questions: ['q2'], answer, active: true },
        ]),
      ).toThrow(HttpException);
      try {
        assertFaqsWithinPlanLimits([
          { title: 't1', questions: ['q1'], answer, active: true },
          { title: 't2', questions: ['q2'], answer, active: true },
        ]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_faq_total_size',
        );
      }
    });

    it('counts Urdu / emoji in UTF-8 bytes (title)', () => {
      const urdu = 'سلام';
      expect(urdu.length).toBeLessThan(getUtf8ByteCount(urdu));
      const title = urdu.repeat(Math.ceil(L.faqTitleMaxBytes / getUtf8ByteCount(urdu)) + 1);
      expect(getUtf8ByteCount(title)).toBeGreaterThan(L.faqTitleMaxBytes);
      expect(() =>
        assertFaqsWithinPlanLimits([{ title, questions: ['q'], answer: 'a', active: true }]),
      ).toThrow(HttpException);
    });
  });

  describe('assertSnippetsWithinPlanLimits', () => {
    it('rejects snippet title over limit', () => {
      const title = 't'.repeat(L.snippetTitleMaxBytes + 1);
      expect(() =>
        assertSnippetsWithinPlanLimits([{ title, snippet: 'body', active: true }]),
      ).toThrow(HttpException);
      try {
        assertSnippetsWithinPlanLimits([{ title, snippet: 'body', active: true }]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_snippet_title_size',
        );
      }
    });

    it('rejects snippet description over limit', () => {
      const snippet = 's'.repeat(L.snippetDescriptionMaxBytes + 1);
      expect(() =>
        assertSnippetsWithinPlanLimits([{ title: 'T', snippet, active: true }]),
      ).toThrow(HttpException);
      try {
        assertSnippetsWithinPlanLimits([{ title: 'T', snippet, active: true }]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_snippet_description_size',
        );
      }
    });

    it('rejects snippet section total over cap', () => {
      const half = Math.floor(L.snippetTotalMaxBytes / 2) + 50_000;
      const snippetA = 'a'.repeat(half);
      const snippetB = 'b'.repeat(half);
      expect(() =>
        assertSnippetsWithinPlanLimits([
          { title: 'A', snippet: snippetA, active: true },
          { title: 'B', snippet: snippetB, active: true },
        ]),
      ).toThrow(HttpException);
      try {
        assertSnippetsWithinPlanLimits([
          { title: 'A', snippet: snippetA, active: true },
          { title: 'B', snippet: snippetB, active: true },
        ]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_snippet_total_size',
        );
      }
    });

    it('allows snippet at exact description limit (within section total)', () => {
      const overhead = getUtf8ByteCount('Snippet');
      const snippet = 'c'.repeat(L.snippetTotalMaxBytes - overhead);
      expect(() =>
        assertSnippetsWithinPlanLimits([{ title: '', snippet, active: true }]),
      ).not.toThrow();
    });
  });

  describe('assertSuggestionsWithinPlanLimits', () => {
    it('rejects label-only text over limit', () => {
      const label = 'l'.repeat(L.suggestionTextMaxBytes + 1);
      expect(() => assertSuggestionsWithinPlanLimits([label])).toThrow(HttpException);
      try {
        assertSuggestionsWithinPlanLimits([label]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_suggestion_text_size',
        );
      }
    });

    it('rejects scoped context over limit', () => {
      const ctx = 'c'.repeat(L.suggestionDescriptionMaxBytes + 1);
      expect(() =>
        assertSuggestionsWithinPlanLimits([{ label: 'ok', context: ctx }]),
      ).toThrow(HttpException);
      try {
        assertSuggestionsWithinPlanLimits([{ label: 'ok', context: ctx }]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_suggestion_description_size',
        );
      }
    });

    it('rejects scopedInformation over limit', () => {
      const scoped = 'c'.repeat(L.suggestionDescriptionMaxBytes + 1);
      expect(() =>
        assertSuggestionsWithinPlanLimits([{ label: 'ok', scopedInformation: scoped }]),
      ).toThrow(HttpException);
    });

    it('rejects description alias over limit', () => {
      const desc = 'd'.repeat(L.suggestionDescriptionMaxBytes + 1);
      expect(() => assertSuggestionsWithinPlanLimits([{ label: 'ok', description: desc }])).toThrow(
        HttpException,
      );
    });

    it('allows label-only at exact byte limit', () => {
      const label = 'x'.repeat(L.suggestionTextMaxBytes);
      expect(() => assertSuggestionsWithinPlanLimits([label])).not.toThrow();
    });

    it('allows label + scoped at limits', () => {
      const label = 'y'.repeat(L.suggestionTextMaxBytes);
      const ctx = 'z'.repeat(Math.min(500, L.suggestionDescriptionMaxBytes));
      expect(() => assertSuggestionsWithinPlanLimits([{ label, context: ctx }])).not.toThrow();
    });

    it('rejects suggestion section total over cap (scoped bytes only)', () => {
      const half = Math.floor(L.suggestionTotalMaxBytes / 2) + 50_000;
      const ctxA = 'a'.repeat(half);
      const ctxB = 'b'.repeat(half);
      expect(() =>
        assertSuggestionsWithinPlanLimits([
          { label: 'l1', context: ctxA },
          { label: 'l2', context: ctxB },
        ]),
      ).toThrow(HttpException);
      try {
        assertSuggestionsWithinPlanLimits([
          { label: 'l1', context: ctxA },
          { label: 'l2', context: ctxB },
        ]);
      } catch (e) {
        expect(((e as HttpException).getResponse() as { errorCode?: string }).errorCode).toBe(
          'plan_limit_suggestion_total_size',
        );
      }
    });

    it('label-only suggestions do not consume suggestion section byte total', () => {
      const label = 'x'.repeat(L.suggestionTextMaxBytes);
      const ctx = 'c'.repeat(Math.min(L.suggestionTotalMaxBytes, L.suggestionDescriptionMaxBytes) - 100);
      expect(() =>
        assertSuggestionsWithinPlanLimits([
          label,
          label,
          { label: 'z', context: ctx },
        ]),
      ).not.toThrow();
    });
  });
});
