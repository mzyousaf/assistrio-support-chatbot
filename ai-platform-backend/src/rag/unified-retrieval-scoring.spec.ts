/**
 * Unit tests for unified retrieval scoring: exact phrase, heading, title, FAQ question, combined.
 */

import {
  exactPhraseScore,
  headingMatchScore,
  titleMatchScore,
  faqQuestionMatchScore,
  computeUnifiedCombinedScore,
  scoreKnowledgeItem,
  DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS,
} from './unified-retrieval-scoring';
import type { KnowledgeItem } from '../knowledge';

describe('unified-retrieval-scoring', () => {
  describe('exactPhraseScore', () => {
    it('returns 1 when full normalized query appears in text', () => {
      expect(exactPhraseScore('refund policy', 'our refund policy is 30 days')).toBe(1);
    });
    it('returns 0 when query is too short', () => {
      expect(exactPhraseScore('ab', 'ab cd')).toBe(0);
    });
    it('returns 0.5 when query words appear in order', () => {
      expect(exactPhraseScore('contact support', 'please contact our support team')).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe('headingMatchScore', () => {
    it('returns 0 when section is empty', () => {
      expect(headingMatchScore('contact', undefined)).toBe(0);
      expect(headingMatchScore('contact', '')).toBe(0);
    });
    it('rewards token overlap with section', () => {
      const score = headingMatchScore('contact support', '9. Contact Support');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('titleMatchScore', () => {
    it('returns 0 when title is empty', () => {
      expect(titleMatchScore('hours', undefined)).toBe(0);
    });
    it('rewards token overlap and phrase in title', () => {
      expect(titleMatchScore('office hours', 'Office Hours')).toBeGreaterThan(0);
      expect(titleMatchScore('office hours', 'Our office hours are 9-5')).toBe(1);
    });
  });

  describe('faqQuestionMatchScore', () => {
    it('returns 0 for non-FAQ source type', () => {
      expect(faqQuestionMatchScore('refund?', 'document', 'How do I get a refund?')).toBe(0);
    });
    it('returns 0 when title is empty', () => {
      expect(faqQuestionMatchScore('refund', 'faq', undefined)).toBe(0);
    });
    it('rewards FAQ question match when sourceType is faq', () => {
      const score = faqQuestionMatchScore('how do i get a refund', 'faq', 'How do I get a refund?');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
    it('returns 1 when query phrase appears in FAQ question', () => {
      expect(faqQuestionMatchScore('get a refund', 'faq', 'How do I get a refund?')).toBe(1);
    });
  });

  describe('computeUnifiedCombinedScore', () => {
    it('uses weights to combine components', () => {
      const breakdown = {
        semanticScore: 0.5,
        lexicalScore: 0.3,
        exactPhraseScore: 0.2,
        headingMatchScore: 0,
        titleMatchScore: 0.1,
        faqQuestionMatchScore: 0,
      };
      const combined = computeUnifiedCombinedScore(breakdown);
      expect(combined).toBeGreaterThan(0);
      expect(combined).toBeLessThanOrEqual(1);
    });
    it('caps combined at 1', () => {
      const breakdown = {
        semanticScore: 1,
        lexicalScore: 1,
        exactPhraseScore: 1,
        headingMatchScore: 1,
        titleMatchScore: 1,
        faqQuestionMatchScore: 1,
      };
      const combined = computeUnifiedCombinedScore(breakdown);
      expect(combined).toBeLessThanOrEqual(1);
    });
  });

  describe('scoreKnowledgeItem', () => {
    it('returns full breakdown including combinedScore', () => {
      const item: KnowledgeItem = {
        id: '1',
        botId: 'bot1',
        sourceType: 'document',
        sourceId: 'doc1',
        title: 'Refund Policy',
        section: 'Refunds',
        text: 'You can request a refund within 30 days.',
        normalizedText: 'you can request a refund within 30 days.',
        active: true,
        status: 'ready',
      };
      const result = scoreKnowledgeItem('refund', item, 0.4, 0.3);
      expect(result).toHaveProperty('semanticScore', 0.4);
      expect(result).toHaveProperty('lexicalScore', 0.3);
      expect(result).toHaveProperty('exactPhraseScore');
      expect(result).toHaveProperty('headingMatchScore');
      expect(result).toHaveProperty('titleMatchScore');
      expect(result).toHaveProperty('faqQuestionMatchScore');
      expect(result).toHaveProperty('combinedScore');
      expect(result.combinedScore).toBeGreaterThanOrEqual(0);
      expect(result.combinedScore).toBeLessThanOrEqual(1);
    });
    it('applies FAQ question bonus for faq source type', () => {
      const item: KnowledgeItem = {
        id: 'faq-1',
        botId: 'bot1',
        sourceType: 'faq',
        sourceId: 'faq-1',
        title: 'What is your refund policy?',
        text: 'Q: What is your refund policy?\nA: 30 days.',
        normalizedText: 'q: what is your refund policy? a: 30 days.',
        active: true,
        status: 'ready',
      };
      const result = scoreKnowledgeItem('refund policy', item, 0, 0.2);
      expect(result.faqQuestionMatchScore).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS', () => {
    it('weights sum to 1 for balanced hybrid', () => {
      const w = DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS;
      const sum = w.semantic + w.lexical + w.exactPhrase + w.headingMatch + w.titleMatch + w.faqQuestionMatch;
      expect(sum).toBeCloseTo(1, 5);
    });
    it('semantic weight is less than 0.5 so other signals matter', () => {
      expect(DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS.semantic).toBeLessThan(0.5);
    });
  });
});
