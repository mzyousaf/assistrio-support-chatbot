import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  normalizeForEmbeddingInput,
  computeEmbeddingInputHash,
  mergeFaqsForSave,
  getNoteEmbeddingStateForSave,
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

  describe('mergeFaqsForSave', () => {
    it('sets pending when no existing or hash changed', () => {
      const out = mergeFaqsForSave(undefined, [{ question: 'Q', answer: 'A' }]);
      expect(out).toHaveLength(1);
      expect(out[0].embeddingStatus).toBe('pending');
      expect(out[0].embeddingInputHash).toBeDefined();
    });
    it('preserves ready when hash matches', () => {
      const input = buildFaqEmbeddingText('Q', 'A');
      const hash = computeEmbeddingInputHash(input);
      const current = [
        { question: 'Q', answer: 'A', embeddingStatus: 'ready' as const, embeddingInputHash: hash, embedding: [0.1], embeddingUpdatedAt: new Date(), embeddingError: null },
      ];
      const out = mergeFaqsForSave(current, [{ question: 'Q', answer: 'A' }]);
      expect(out[0].embeddingStatus).toBe('ready');
      expect(out[0].embedding).toEqual([0.1]);
    });
    it('reorder preserves ready when content unchanged (match by hash)', () => {
      const hash1 = computeEmbeddingInputHash(buildFaqEmbeddingText('Q1', 'A1'));
      const hash2 = computeEmbeddingInputHash(buildFaqEmbeddingText('Q2', 'A2'));
      const current = [
        { question: 'Q1', answer: 'A1', embeddingStatus: 'ready' as const, embeddingInputHash: hash1, embedding: [1], embeddingUpdatedAt: new Date(), embeddingError: null },
        { question: 'Q2', answer: 'A2', embeddingStatus: 'ready' as const, embeddingInputHash: hash2, embedding: [2], embeddingUpdatedAt: new Date(), embeddingError: null },
      ];
      const newFaqs = [{ question: 'Q2', answer: 'A2' }, { question: 'Q1', answer: 'A1' }];
      const out = mergeFaqsForSave(current, newFaqs);
      expect(out).toHaveLength(2);
      expect(out[0].embeddingStatus).toBe('ready');
      expect(out[0].embedding).toEqual([2]);
      expect(out[1].embeddingStatus).toBe('ready');
      expect(out[1].embedding).toEqual([1]);
    });
    it('whitespace-only change keeps same hash so preserves ready', () => {
      const input = buildFaqEmbeddingText('Q', 'A');
      const hash = computeEmbeddingInputHash(input);
      const current = [
        { question: 'Q', answer: 'A', embeddingStatus: 'ready' as const, embeddingInputHash: hash, embedding: [0.1], embeddingUpdatedAt: new Date(), embeddingError: null },
      ];
      const out = mergeFaqsForSave(current, [{ question: '  Q  ', answer: '  A  ' }]);
      expect(out[0].embeddingStatus).toBe('ready');
      expect(out[0].embedding).toEqual([0.1]);
    });
    it('changed question sets pending', () => {
      const hash = computeEmbeddingInputHash(buildFaqEmbeddingText('Q', 'A'));
      const current = [
        { question: 'Q', answer: 'A', embeddingStatus: 'ready' as const, embeddingInputHash: hash, embedding: [0.1], embeddingUpdatedAt: new Date(), embeddingError: null },
      ];
      const out = mergeFaqsForSave(current, [{ question: 'Q2', answer: 'A' }]);
      expect(out[0].embeddingStatus).toBe('pending');
      expect(out[0].embeddingInputHash).not.toBe(hash);
    });
    it('changed answer sets pending', () => {
      const hash = computeEmbeddingInputHash(buildFaqEmbeddingText('Q', 'A'));
      const current = [
        { question: 'Q', answer: 'A', embeddingStatus: 'ready' as const, embeddingInputHash: hash, embedding: [0.1], embeddingUpdatedAt: new Date(), embeddingError: null },
      ];
      const out = mergeFaqsForSave(current, [{ question: 'Q', answer: 'A2' }]);
      expect(out[0].embeddingStatus).toBe('pending');
    });
  });

  describe('getNoteEmbeddingStateForSave', () => {
    it('returns pending when content changed or no current', () => {
      const s = getNoteEmbeddingStateForSave(undefined, undefined, 'New text');
      expect(s.noteEmbeddingStatus).toBe('pending');
    });
    it('returns ready when hash and status match', () => {
      const input = buildNoteEmbeddingText(undefined, 'Same');
      const hash = computeEmbeddingInputHash(input);
      const s = getNoteEmbeddingStateForSave(hash, 'ready', 'Same');
      expect(s.noteEmbeddingStatus).toBe('ready');
    });
    it('same note text keeps ready', () => {
      const input = buildNoteEmbeddingText(undefined, 'Note content');
      const hash = computeEmbeddingInputHash(input);
      const s = getNoteEmbeddingStateForSave(hash, 'ready', 'Note content');
      expect(s.noteEmbeddingStatus).toBe('ready');
    });
    it('whitespace-only note change keeps ready (normalized hash)', () => {
      const input = buildNoteEmbeddingText(undefined, 'Note content');
      const hash = computeEmbeddingInputHash(input);
      const s = getNoteEmbeddingStateForSave(hash, 'ready', '  Note   content  ');
      expect(s.noteEmbeddingStatus).toBe('ready');
    });
    it('changed note sets pending', () => {
      const hash = computeEmbeddingInputHash(buildNoteEmbeddingText(undefined, 'Old'));
      const s = getNoteEmbeddingStateForSave(hash, 'ready', 'New content');
      expect(s.noteEmbeddingStatus).toBe('pending');
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

  describe('mergeFaqsForSave (deleted FAQ)', () => {
    it('merged list only contains new FAQs (deleted ones disappear)', () => {
      const hash1 = computeEmbeddingInputHash(buildFaqEmbeddingText('Q1', 'A1'));
      const current = [
        { question: 'Q1', answer: 'A1', embeddingStatus: 'ready' as const, embeddingInputHash: hash1, embedding: [1], embeddingUpdatedAt: new Date(), embeddingError: null },
      ];
      const newFaqs = [{ question: 'Q1', answer: 'A1' }];
      const out = mergeFaqsForSave(current, newFaqs);
      expect(out).toHaveLength(1);
      expect(out[0].embeddingStatus).toBe('ready');
      const currentTwo = [
        ...current,
        { question: 'Q2', answer: 'A2', embeddingStatus: 'pending' as const, embeddingInputHash: 'x', embedding: undefined, embeddingUpdatedAt: undefined, embeddingError: null },
      ];
      const newFaqsOnlyFirst = [{ question: 'Q1', answer: 'A1' }];
      const outAfterDelete = mergeFaqsForSave(currentTwo, newFaqsOnlyFirst);
      expect(outAfterDelete).toHaveLength(1);
      expect(outAfterDelete[0].question).toBe('Q1');
      expect(outAfterDelete[0].embeddingStatus).toBe('ready');
    });
  });
});
