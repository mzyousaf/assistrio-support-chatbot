import { describe, expect, it } from 'vitest';
import type { CustomerBotDetail, CustomerConversationMessage } from '@/api/types';
import {
  isWelcomeChatLogMessage,
  synthesizePlaygroundWelcomeMessage,
  withPlaygroundWelcomeIfNeeded,
} from './playgroundTranscriptWelcome';

const bot = {
  id: 'bot-1',
  name: 'Acme Bot',
  welcomeMessage: 'Hello {{Name}}',
  welcomeMessageEnabled: true,
} as CustomerBotDetail;

describe('playgroundTranscriptWelcome', () => {
  it('detects persisted and synthetic welcome rows', () => {
    expect(isWelcomeChatLogMessage({ role: 'assistant', messageId: 'welcome_bot-1' } as CustomerConversationMessage)).toBe(
      true,
    );
    expect(isWelcomeChatLogMessage({ role: 'assistant', isWelcomeMessage: true } as CustomerConversationMessage)).toBe(
      true,
    );
    expect(isWelcomeChatLogMessage({ role: 'user', messageId: 'x' } as CustomerConversationMessage)).toBe(false);
  });

  it('prepends synthetic welcome when playground transcript lacks one', () => {
    const rows: CustomerConversationMessage[] = [
      {
        id: 'm1',
        messageId: 'm1',
        role: 'user',
        content: 'Hi',
        text: 'Hi',
        createdAt: '2024-01-01T00:00:01.000Z',
      },
    ];
    const out = withPlaygroundWelcomeIfNeeded(rows, bot, true);
    expect(out).toHaveLength(2);
    expect(isWelcomeChatLogMessage(out[0]!)).toBe(true);
    expect(out[0]?.content).toBe('Hello Acme Bot');
  });

  it('synthesizePlaygroundWelcomeMessage returns null when disabled', () => {
    expect(
      synthesizePlaygroundWelcomeMessage(
        { ...bot, welcomeMessageEnabled: false } as CustomerBotDetail,
        '2024-01-01T00:00:00.000Z',
      ),
    ).toBeNull();
  });
});
