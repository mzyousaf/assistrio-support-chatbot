import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationWorkspaceUserMessage } from './ConversationWorkspaceUserMessage';
import type { CustomerConversationMessage } from '@/api/types';

const message = {
  id: 'm1',
  messageId: 'm1',
  role: 'user',
  content: 'Hello',
  text: 'Hello',
  createdAt: '2024-06-15T14:30:00.000Z',
} as CustomerConversationMessage;

describe('ConversationWorkspaceUserMessage', () => {
  it('renders user message body', () => {
    const html = renderToStaticMarkup(<ConversationWorkspaceUserMessage message={message} />);
    expect(html).toContain('Hello');
  });

  it('wraps playground user bubble for sent-time tooltip', () => {
    const html = renderToStaticMarkup(
      <ConversationWorkspaceUserMessage message={message} showBubbleSentTimeTooltip />,
    );
    expect(html).toContain('Hello');
    expect(html).toContain('relative');
  });
});
