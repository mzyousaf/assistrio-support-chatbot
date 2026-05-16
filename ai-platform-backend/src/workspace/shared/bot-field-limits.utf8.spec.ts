import { clampStrUtf8Bytes, utf8ByteLength } from './bot-field-limits';

describe('utf8ByteLength / clampStrUtf8Bytes', () => {
  it('counts UTF-8 bytes', () => {
    expect(utf8ByteLength('')).toBe(0);
    expect(utf8ByteLength('a')).toBe(1);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('你好')).toBe(6);
  });

  it('returns input unchanged when under limit', () => {
    expect(clampStrUtf8Bytes('hello', 10)).toBe('hello');
  });

  it('truncates on UTF-8 boundary', () => {
    const s = 'aé';
    expect(utf8ByteLength(s)).toBe(3);
    expect(clampStrUtf8Bytes(s, 2)).toBe('a');
    expect(clampStrUtf8Bytes(s, 3)).toBe('aé');
  });
});
