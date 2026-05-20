import {
  GREETING_FAST_PATH_HELLO_REPLY,
  GREETING_FAST_PATH_THANKS_REPLY,
  isSimpleGreetingFastPathMessage,
  resolveGreetingFastPathReply,
} from './chat-greeting-fast-path.util';

describe('isSimpleGreetingFastPathMessage', () => {
  it('matches simple greetings', () => {
    expect(isSimpleGreetingFastPathMessage('Hi')).toBe(true);
    expect(isSimpleGreetingFastPathMessage('hello')).toBe(true);
    expect(isSimpleGreetingFastPathMessage('hey!')).toBe(true);
    expect(isSimpleGreetingFastPathMessage('thank you')).toBe(true);
    expect(isSimpleGreetingFastPathMessage('thanks')).toBe(true);
  });

  it('does not match factual questions', () => {
    expect(isSimpleGreetingFastPathMessage('What does Assistrio do?')).toBe(false);
    expect(isSimpleGreetingFastPathMessage('How much does it cost?')).toBe(false);
    expect(isSimpleGreetingFastPathMessage('Tell me about Assistrio')).toBe(false);
    expect(isSimpleGreetingFastPathMessage('hi what does Assistrio do')).toBe(false);
    expect(isSimpleGreetingFastPathMessage('Hi, what does Assistrio do?')).toBe(false);
    expect(isSimpleGreetingFastPathMessage('Hello, what are your prices?')).toBe(false);
  });

  it('does not match creative or support asks', () => {
    expect(isSimpleGreetingFastPathMessage('Give me 5 welcome messages')).toBe(false);
    expect(isSimpleGreetingFastPathMessage('I need support with pricing')).toBe(false);
  });
});

describe('resolveGreetingFastPathReply', () => {
  it('returns hello reply for greetings', () => {
    expect(resolveGreetingFastPathReply('hi')).toBe(GREETING_FAST_PATH_HELLO_REPLY);
    expect(resolveGreetingFastPathReply('hello')).toBe(GREETING_FAST_PATH_HELLO_REPLY);
  });

  it('returns thanks reply for gratitude', () => {
    expect(resolveGreetingFastPathReply('thanks')).toBe(GREETING_FAST_PATH_THANKS_REPLY);
    expect(resolveGreetingFastPathReply('thank you')).toBe(GREETING_FAST_PATH_THANKS_REPLY);
  });
});
