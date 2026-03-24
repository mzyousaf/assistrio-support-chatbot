import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  normalizeForEmbeddingInput,
  computeEmbeddingInputHash,
  isEmbeddingValidForSemantic,
} from './faq-note-embedding.helper';

describe('faq-note-embedding.helper', () => {
  describe('buildFaqEmbeddingText', () => {
    it('formats question and answer', () => {
      expect(buildFaqEmbeddingText('What hours?', 'We open at 9.')).toBe(
        'Question: What hours?\nAnswer: We open at 9.',
      );
    });
    it('trims question and answer', () => {
      expect(buildFaqEmbeddingText('  Q  ', '  A  ')).toBe('Question: Q\nAnswer: A');
    });
  });

  describe('buildNoteEmbeddingText', () => {
    it('includes title when present', () => {
      expect(buildNoteEmbeddingText('Overview', 'Some text.')).toBe(
        'Title: Overview\nText: Some text.',
      );
    });
    it('handles empty title', () => {
      expect(buildNoteEmbeddingText(undefined, 'Only text.')).toBe('Title:\nText: Only text.');
    });
  });

  describe('normalizeForEmbeddingInput', () => {
    it('lowercases and collapses whitespace', () => {
      expect(normalizeForEmbeddingInput('  Hello   World  ')).toBe('hello world');
    });
    it('returns empty for null/empty', () => {
      expect(normalizeForEmbeddingInput('')).toBe('');
      expect(normalizeForEmbeddingInput(null as unknown as string)).toBe('');
    });
  });

  describe('computeEmbeddingInputHash', () => {
    it('returns stable 32-char hex', () => {
      const h = computeEmbeddingInputHash('Question: x\nAnswer: y');
      expect(h).toMatch(/^[a-f0-9]{32}$/);
      expect(computeEmbeddingInputHash('Question: x\nAnswer: y')).toBe(h);
    });
    it('differs for different content', () => {
      expect(computeEmbeddingInputHash('a')).not.toBe(computeEmbeddingInputHash('b'));
    });
  });

  describe('isEmbeddingValidForSemantic', () => {
    const hash = computeEmbeddingInputHash('test');
    const embedding = [0.1, 0.2];

    it('returns true when ready, hash match, and embedding present', () => {
      expect(isEmbeddingValidForSemantic('ready', hash, hash, embedding)).toBe(true);
    });
    it('returns false when status is pending', () => {
      expect(isEmbeddingValidForSemantic('pending', hash, hash, embedding)).toBe(false);
    });
    it('returns false when status is failed', () => {
      expect(isEmbeddingValidForSemantic('failed', hash, hash, embedding)).toBe(false);
    });
    it('returns false when hash mismatch', () => {
      expect(isEmbeddingValidForSemantic('ready', hash, 'other', embedding)).toBe(false);
    });
    it('returns false when embedding empty or missing', () => {
      expect(isEmbeddingValidForSemantic('ready', hash, hash, [])).toBe(false);
      expect(isEmbeddingValidForSemantic('ready', hash, hash, undefined)).toBe(false);
      expect(isEmbeddingValidForSemantic('ready', hash, hash, null)).toBe(false);
    });
    it('returns false when status undefined', () => {
      expect(isEmbeddingValidForSemantic(undefined, hash, hash, embedding)).toBe(false);
    });
  });

  });