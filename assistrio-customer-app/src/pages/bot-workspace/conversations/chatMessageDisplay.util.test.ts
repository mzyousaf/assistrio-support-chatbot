import { describe, expect, it } from 'vitest';
import {
  linkifyBareHttpUrls,
  prepareChatMessageMarkdown,
  prepareChatMessagePlainText,
  stripInlineCitationMarkers,
} from '@acw/lib/chatMessageDisplay.util';

describe('stripInlineCitationMarkers', () => {
  it('leaves plain numbers and everyday phrases unchanged', () => {
    const samples = [
      'Give me 5 creative ways to say our support team is available 24/7.',
      'Here are five creative ways to say your support team is available 24/7.',
      '24/7 support',
      'Step 1: Install widget',
      'Version 2.0',
      '100 users',
    ];
    for (const s of samples) {
      expect(stripInlineCitationMarkers(s)).toBe(s);
    }
  });

  it('removes citation markers and broken slash forms', () => {
    expect(stripInlineCitationMarkers('Assistrio helps businesses [1] [2]/[7].')).toBe(
      'Assistrio helps businesses.',
    );
    expect(stripInlineCitationMarkers('Assistrio helps [2](https://example.com).')).toBe(
      'Assistrio helps.',
    );
    expect(stripInlineCitationMarkers('Answer per source [1] and [2].')).toBe('Answer per source and.');
    expect(stripInlineCitationMarkers('available 24[2](/7)')).toBe('available 24');
    expect(stripInlineCitationMarkers('Give me 5[5](url) creative')).toBe('Give me 5 creative');
    expect(
      stripInlineCitationMarkers(
        'Give me [5] creative ways to say our support team is available [2][4] / [7].',
      ),
    ).toBe('Give me creative ways to say our support team is available.');
    expect(
      stripInlineCitationMarkers(
        'Here are five creative ways to say your support team is available [2][4] / [7]:',
      ),
    ).toBe('Here are five creative ways to say your support team is available:');
  });
});

describe('prepareChatMessagePlainText', () => {
  it('strips citations for user/insights plain rendering', () => {
    expect(
      prepareChatMessagePlainText(
        'Give me 5 creative ways to say our support team is available 24/7.',
      ),
    ).toBe('Give me 5 creative ways to say our support team is available 24/7.');
  });
});

describe('prepareChatMessageMarkdown', () => {
  it('linkifies bare http(s) URLs after citation strip', () => {
    expect(prepareChatMessageMarkdown('Visit https://example.com for details.')).toBe(
      'Visit [https://example.com](https://example.com) for details.',
    );
  });

  it('preserves Markdown bullet lines for list rendering', () => {
    const raw = '- Fast support\n- 24/7 availability';
    expect(prepareChatMessageMarkdown(raw)).toBe(raw);
  });
});

describe('linkifyBareHttpUrls', () => {
  it('does not linkify non-url text', () => {
    expect(linkifyBareHttpUrls('24/7')).toBe('24/7');
  });
});
