import type { CustomerBotDetail, CustomerConversationMessage } from '@/api/types';
import { resolveWelcomeMessage } from '@acw/lib/welcomeMessage';

export function isWelcomeChatLogMessage(message: CustomerConversationMessage): boolean {
  const role = (message.role ?? '').toLowerCase();
  if (role !== 'assistant') return false;
  const uid = String(message.messageId ?? message.id ?? '');
  return uid.startsWith('welcome_') || message.isWelcomeMessage === true || message.inputType === 'welcome';
}

export function synthesizePlaygroundWelcomeMessage(
  bot: CustomerBotDetail,
  createdAt: string,
): CustomerConversationMessage | null {
  if (bot.welcomeMessageEnabled === false) return null;
  const template = typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage.trim() : '';
  if (!template) return null;
  const content = resolveWelcomeMessage(template, {
    name: bot.name,
    tagline: bot.shortDescription,
    description: bot.description,
  });
  const welcomeId = `welcome_${bot.id}`;
  return {
    id: welcomeId,
    messageId: welcomeId,
    role: 'assistant',
    content,
    text: content,
    createdAt,
    isWelcomeMessage: true,
    inputType: 'welcome',
  };
}

/** Older playground threads may lack a persisted welcome row — synthesize from bot config when needed. */
export function withPlaygroundWelcomeIfNeeded(
  messages: CustomerConversationMessage[],
  bot: CustomerBotDetail | null,
  playgroundTranscript: boolean,
): CustomerConversationMessage[] {
  if (!playgroundTranscript || !bot || messages.length === 0) return messages;
  if (messages.some(isWelcomeChatLogMessage)) return messages;
  const welcome = synthesizePlaygroundWelcomeMessage(bot, messages[0]?.createdAt ?? new Date().toISOString());
  return welcome ? [welcome, ...messages] : messages;
}
