import {
  resolveOverLimitLockedBotIds,
  WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON,
} from './workspace-bot-over-limit.util';

describe('resolveOverLimitLockedBotIds', () => {
  it('locks newest bots when count exceeds limit', () => {
    const locked = resolveOverLimitLockedBotIds(
      [
        { id: 'bot-old', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'bot-mid', createdAt: '2024-02-01T00:00:00.000Z' },
        { id: 'bot-new', createdAt: '2024-03-01T00:00:00.000Z' },
      ],
      1,
    );
    expect([...locked]).toEqual(['bot-mid', 'bot-new']);
  });

  it('uses id tie-breaker when createdAt matches', () => {
    const locked = resolveOverLimitLockedBotIds(
      [
        { id: 'b-b', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'b-a', createdAt: '2024-01-01T00:00:00.000Z' },
      ],
      1,
    );
    expect([...locked]).toEqual(['b-b']);
  });

  it('returns empty set when within limit', () => {
    const locked = resolveOverLimitLockedBotIds(
      [{ id: 'bot-1', createdAt: '2024-01-01T00:00:00.000Z' }],
      1,
    );
    expect(locked.size).toBe(0);
  });

  it('exports stable locked reason key', () => {
    expect(WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON).toBe('workspace_bot_limit_exceeded');
  });
});
