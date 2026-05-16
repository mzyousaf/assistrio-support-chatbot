import { getUtf8ByteCount, getUtf8ByteCountForJson } from './knowledge-byte-size.util';

describe('knowledge-byte-size.util', () => {
  describe('getUtf8ByteCount', () => {
    it('counts ASCII by bytes', () => {
      expect(getUtf8ByteCount('hello')).toBe(5);
    });

    it('counts multi-byte UTF-8 (Urdu / Arabic) where bytes exceed character length', () => {
      const urdu = 'سلام';
      expect(urdu.length).toBe(4);
      expect(getUtf8ByteCount(urdu)).toBeGreaterThan(urdu.length);
      expect(getUtf8ByteCount(urdu)).toBe(Buffer.byteLength(urdu, 'utf8'));
    });

    it('counts emoji as 4 UTF-8 bytes', () => {
      const s = '🙂';
      expect(s.length).toBe(2); // surrogate pair in JS
      expect(getUtf8ByteCount(s)).toBe(4);
    });

    it('treats empty, null, and undefined as empty string', () => {
      expect(getUtf8ByteCount('')).toBe(0);
      expect(getUtf8ByteCount(null)).toBe(0);
      expect(getUtf8ByteCount(undefined)).toBe(0);
    });
  });

  describe('getUtf8ByteCountForJson', () => {
    it('measures JSON serialization in UTF-8 bytes', () => {
      expect(getUtf8ByteCountForJson({ a: 1 })).toBe(Buffer.byteLength(JSON.stringify({ a: 1 }), 'utf8'));
    });

    it('returns 0 when JSON.stringify yields undefined', () => {
      expect(getUtf8ByteCountForJson(undefined)).toBe(0);
    });
  });
});
