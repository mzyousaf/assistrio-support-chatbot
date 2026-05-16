import { describe, expect, it } from 'vitest';
import { createStablePreviewOverridesKey } from '../../../chat-widget/src/lib/stablePreviewOverridesKey';

describe('createStablePreviewOverridesKey', () => {
  it('returns empty string for undefined / empty', () => {
    expect(createStablePreviewOverridesKey(undefined)).toBe('');
    expect(createStablePreviewOverridesKey(null)).toBe('');
    expect(createStablePreviewOverridesKey({})).toBe('');
  });

  it('changes when semantic preview fields change (dark / avatar path)', () => {
    const a = createStablePreviewOverridesKey({
      chatUI: { backgroundStyle: 'light' },
      avatarUrl: 'https://example.com/a.png',
    });
    const b = createStablePreviewOverridesKey({
      chatUI: { backgroundStyle: 'dark' },
      avatarUrl: 'https://example.com/a.png',
    });
    const c = createStablePreviewOverridesKey({
      chatUI: { backgroundStyle: 'light' },
      avatarUrl: 'https://example.com/b.png',
    });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('does not vary for plain-object key insertion order differences', () => {
    expect(
      createStablePreviewOverridesKey({
        a: 1,
        b: 2,
        chatUI: { z: true, primaryColor: '#111111', y: 0 },
      }),
    ).toBe(
      createStablePreviewOverridesKey({
        b: 2,
        chatUI: { y: 0, primaryColor: '#111111', z: true },
        a: 1,
      }),
    );
  });

  it('treats array order as significant (suggestedQuestions)', () => {
    expect(
      createStablePreviewOverridesKey({ suggestedQuestions: ['one', 'two'] }),
    ).not.toBe(createStablePreviewOverridesKey({ suggestedQuestions: ['two', 'one'] }));
  });

  it('ignores undefined values', () => {
    expect(createStablePreviewOverridesKey({ botName: 'X', avatarUrl: undefined })).toBe(
      createStablePreviewOverridesKey({ botName: 'X' }),
    );
  });

  it('does not stringify functions (drops them)', () => {
    const withFn = { botName: 'Test', onSomething: (): void => {} };
    expect(createStablePreviewOverridesKey(withFn)).toBe(createStablePreviewOverridesKey({ botName: 'Test' }));
  });
});
