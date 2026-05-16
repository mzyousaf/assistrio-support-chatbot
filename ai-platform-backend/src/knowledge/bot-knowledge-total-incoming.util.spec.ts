import { getUtf8ByteCount } from './knowledge-byte-size.util';
import { buildSuggestionEmbeddingText } from './faq-note-embedding.helper';
import { incomingSuggestionSectionUtf8Bytes } from './bot-knowledge-total-incoming.util';

describe('bot-knowledge-total-incoming.util', () => {
  describe('incomingSuggestionSectionUtf8Bytes', () => {
    it('counts only scoped context UTF-8, not chip label', () => {
      const questions = [{ label: 'Short', context: 'scoped text' }];
      expect(incomingSuggestionSectionUtf8Bytes(questions)).toBe(getUtf8ByteCount('scoped text'));
    });

    it('label length does not change incoming bytes for scoped rows', () => {
      const ctx = 'same';
      const a = incomingSuggestionSectionUtf8Bytes([{ label: 'A', context: ctx }]);
      const b = incomingSuggestionSectionUtf8Bytes([{ label: 'B'.repeat(400), context: ctx }]);
      expect(a).toBe(b);
      expect(a).toBe(getUtf8ByteCount(ctx));
    });

    it('label-only rows contribute 0', () => {
      expect(incomingSuggestionSectionUtf8Bytes([{ label: 'one' }, { label: 'two' }])).toBe(0);
    });

    it('matches embedding byte length only when chip is empty (edge)', () => {
      const chip = '';
      const scoped = 'only';
      const embedLine = buildSuggestionEmbeddingText(chip, scoped);
      expect(incomingSuggestionSectionUtf8Bytes([{ label: 'ignored', context: scoped }])).toBe(
        getUtf8ByteCount(scoped),
      );
      expect(getUtf8ByteCount(embedLine)).toBeGreaterThan(getUtf8ByteCount(scoped));
    });
  });
});
