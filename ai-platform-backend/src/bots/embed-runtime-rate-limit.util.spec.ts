import { consumeEmbedRuntimeRateLimitToken } from './embed-runtime-rate-limit.util';

describe('consumeEmbedRuntimeRateLimitToken', () => {
  it('allows all when limit is 0', () => {
    expect(consumeEmbedRuntimeRateLimitToken('a', 0)).toBe(true);
    expect(consumeEmbedRuntimeRateLimitToken('a', 0)).toBe(true);
  });

  it('blocks after max in window', () => {
    const key = `t_${Math.random().toString(36).slice(2)}`;
    expect(consumeEmbedRuntimeRateLimitToken(key, 2)).toBe(true);
    expect(consumeEmbedRuntimeRateLimitToken(key, 2)).toBe(true);
    expect(consumeEmbedRuntimeRateLimitToken(key, 2)).toBe(false);
  });
});
