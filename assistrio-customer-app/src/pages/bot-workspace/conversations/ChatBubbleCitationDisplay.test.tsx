import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatBubble } from '@acw/components/chat-ui/ChatBubble';
import { AssistantSourcesInlineList } from './AssistantSourcesInlineList';

const baseMessage = {
  id: 'msg_1',
  role: 'assistant' as const,
  content: '',
  createdAt: new Date().toISOString(),
  status: 'sent' as const,
};

function numericOnlyAnchors(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll('a')).filter((a) => /^\d+$/.test(a.textContent?.trim() ?? ''));
}

function citationBadgeLike(container: HTMLElement): Element[] {
  return Array.from(
    container.querySelectorAll(
      '[class*="text-blue-400"], [class*="citation"], [class*="source-badge"], [class*="footnote"]',
    ),
  );
}

describe('ChatBubble citation display', () => {
  it('user message: plain numbers in 24/7 and 5 with no anchors or badge classes', () => {
    const { container } = render(
      <ChatBubble
        message={{
          ...baseMessage,
          id: 'u1',
          role: 'user',
          content: 'Give me 5 creative ways to say our support team is available 24/7.',
        }}
      />,
    );
    const bubble = container.querySelector('.chat-bubble-content');
    expect(bubble?.textContent).toContain('Give me 5 creative ways');
    expect(bubble?.textContent).toContain('24/7');
    expect(numericOnlyAnchors(container)).toHaveLength(0);
    expect(citationBadgeLike(container)).toHaveLength(0);
    expect(container.querySelector('sup')).toBeNull();
  });

  it('assistant message: 24/7 and list numbers stay plain without numeric anchors', () => {
    const { container } = render(
      <ChatBubble
        allowMarkdown
        message={{
          ...baseMessage,
          content: 'Here are five creative ways to say your support team is available 24/7.',
        }}
      />,
    );
    const bubble = container.querySelector('.chat-bubble-content');
    expect(bubble?.textContent).toContain('24/7');
    expect(numericOnlyAnchors(container)).toHaveLength(0);
    expect(citationBadgeLike(container)).toHaveLength(0);
    expect(container.querySelector('sup')).toBeNull();
  });

  it('assistant message: strips playground citation markers from screenshot-like text', () => {
    const { container } = render(
      <ChatBubble
        allowMarkdown
        message={{
          ...baseMessage,
          content:
            'Give me [5] creative ways to say our support team is available [2][4] / [7].',
        }}
      />,
    );
    expect(container.textContent).toContain('Give me creative ways');
    expect(container.textContent).toContain('available.');
    expect(container.textContent).not.toMatch(/\[5\]|\[7\]|\/\s*7/);
    expect(numericOnlyAnchors(container)).toHaveLength(0);
    expect(citationBadgeLike(container)).toHaveLength(0);
  });

  it('assistant message: strips [1] [2]/[7] citation markers', () => {
    const { container } = render(
      <ChatBubble
        allowMarkdown
        message={{
          ...baseMessage,
          content: 'Assistrio helps businesses [1] [2]/[7].',
        }}
      />,
    );
    expect(container.textContent).toContain('Assistrio helps businesses.');
    expect(container.textContent).not.toMatch(/\[1\]|\[7\]/);
    expect(numericOnlyAnchors(container)).toHaveLength(0);
  });

  it('assistant message: renders backtick citation digits as plain text', () => {
    const { container } = render(
      <ChatBubble
        allowMarkdown
        message={{
          ...baseMessage,
          content: 'Give me `5` creative ways with `2` and `4` markers.',
        }}
      />,
    );
    expect(container.textContent).toContain('Give me 5 creative ways');
    expect(container.querySelector('code')).toBeNull();
    expect(citationBadgeLike(container)).toHaveLength(0);
  });

  it('assistant message: strips numeric markdown links', () => {
    const { container } = render(
      <ChatBubble
        allowMarkdown
        message={{
          ...baseMessage,
          content: 'Assistrio helps [2](https://example.com).',
        }}
      />,
    );
    expect(screen.getByText(/Assistrio helps\./)).toBeTruthy();
    expect(numericOnlyAnchors(container)).toHaveLength(0);
    expect(citationBadgeLike(container)).toHaveLength(0);
  });

  it('assistant message: plain text while streaming, markdown when sent', () => {
    const streaming = render(
      <ChatBubble
        message={{
          ...baseMessage,
          status: 'streaming',
          content: '**Bold** and *italic* while streaming.',
        }}
      />,
    );
    expect(streaming.container.querySelector('.chat-md-root')).toBeNull();
    expect(streaming.container.querySelector('strong.chat-md-strong')).toBeNull();
    expect(streaming.container.textContent).toContain('**Bold**');

    const sent = render(
      <ChatBubble
        message={{
          ...baseMessage,
          status: 'sent',
          content: '**Bold** and *italic* when complete.',
        }}
      />,
    );
    expect(sent.container.querySelector('strong.chat-md-strong')).not.toBeNull();
    expect(sent.container.querySelector('em.chat-md-em')).not.toBeNull();
    expect(sent.container.textContent).toContain('when complete.');
  });

  it('assistant message: markdown "- item" lines render as ul/li with list classes', () => {
    const { container } = render(
      <ChatBubble
        message={{
          ...baseMessage,
          status: 'sent',
          content: '- Fast support\n- 24/7 availability\n- Consistent answers',
        }}
      />,
    );
    const ul = container.querySelector('ul.chat-md-ul');
    expect(ul).not.toBeNull();
    const items = ul?.querySelectorAll(':scope > li.chat-md-li');
    expect(items?.length).toBe(3);
    expect(ul?.textContent).toContain('Fast support');
    expect(ul?.textContent).toContain('24/7 availability');
  });

  it('assistant message: renders GFM lists and tables', () => {
    const { container } = render(
      <ChatBubble
        message={{
          ...baseMessage,
          content: '**Plan**\n\n- Alpha\n- Beta\n\n| Tier | Price |\n| --- | --- |\n| Pro | $10 |',
        }}
      />,
    );
    expect(container.querySelector('ul.chat-md-ul')).not.toBeNull();
    expect(container.querySelector('table.chat-md-table')).not.toBeNull();
    expect(container.textContent).toContain('Alpha');
    expect(container.textContent).toContain('Pro');
  });

  it('assistant message: real code fences render as pre/code', () => {
    const { container } = render(
      <ChatBubble
        message={{
          ...baseMessage,
          content: 'Use `npm install` or:\n\n```js\nconst x = 1;\n```',
        }}
      />,
    );
    expect(container.querySelector('code.chat-md-inline-code')).not.toBeNull();
    expect(container.querySelector('pre.chat-md-pre')).not.toBeNull();
  });

  it('assistant message: real URL renders as normal http link, not numeric badge', () => {
    const { container } = render(
      <ChatBubble
        allowMarkdown
        message={{
          ...baseMessage,
          content: 'Visit https://example.com for details.',
        }}
      />,
    );
    const link = container.querySelector('a[href="https://example.com"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('https://example.com');
    expect(numericOnlyAnchors(container)).toHaveLength(0);
    expect(citationBadgeLike(container)).toHaveLength(0);
  });

  it('Sources used panel still renders separately', () => {
    const html = renderToStaticMarkup(
      <AssistantSourcesInlineList
        sources={[
          {
            chunkId: 'c1',
            sourceTitle: 'Pricing FAQ',
            preview: 'Plans start at $10',
            score: 0.9,
          },
        ]}
        onViewAll={() => {}}
      />,
    );
    expect(html).toContain('Sources used');
    expect(html).toContain('Pricing FAQ');
  });
});
