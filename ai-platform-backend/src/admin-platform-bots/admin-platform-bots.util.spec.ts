import { isPlatformBotType, platformBotTypeLabel } from '../platform-bots/platform-bot.util';

describe('platform-bot.util', () => {
  it('accepts known platform bot types', () => {
    expect(isPlatformBotType('landing_demo')).toBe(true);
    expect(isPlatformBotType('showcase')).toBe(true);
    expect(isPlatformBotType('support')).toBe(true);
    expect(isPlatformBotType('internal')).toBe(true);
    expect(isPlatformBotType('customer')).toBe(false);
  });

  it('maps type labels for admin UI', () => {
    expect(platformBotTypeLabel('landing_demo')).toBe('Landing demo');
    expect(platformBotTypeLabel('showcase')).toBe('Showcase');
    expect(platformBotTypeLabel('support')).toBe('Support');
    expect(platformBotTypeLabel('internal')).toBe('Internal');
  });
});
