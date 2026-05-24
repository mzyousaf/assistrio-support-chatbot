import { describe, expect, it } from 'vitest';
import { appendSearchToPath } from './PreserveSearchNavigate';
import {
  customerBotPlaygroundPath,
  postOnboardingGoLiveBotDestination,
  postOnboardingGoLiveBotsListFallback,
} from './postGoLiveNavigation';

describe('appendSearchToPath', () => {
  it('appends current search to redirect target', () => {
    expect(appendSearchToPath('playground/profile', '?showInstall=1&liveBotId=abc')).toBe(
      'playground/profile?showInstall=1&liveBotId=abc',
    );
  });

  it('leaves path unchanged when search is empty', () => {
    expect(appendSearchToPath('playground/profile', '')).toBe('playground/profile');
  });

  it('does not double-append when target already has query', () => {
    expect(appendSearchToPath('playground/profile?x=1', '?showInstall=1')).toBe('playground/profile?x=1');
  });
});

describe('postGoLiveNavigation', () => {
  const botId = '507f1f77bcf86cd799439011';

  it('builds bot playground path', () => {
    expect(customerBotPlaygroundPath(botId)).toBe(`/bots/${botId}/playground`);
  });

  it('routes onboarding completion to bot playground with install modal params', () => {
    expect(postOnboardingGoLiveBotDestination(botId)).toBe(
      `/bots/${botId}/playground?showInstall=1&liveBotId=${botId}`,
    );
  });

  it('falls back to bots list with modal params', () => {
    expect(postOnboardingGoLiveBotsListFallback(botId)).toBe(
      `/bots?showInstall=1&liveBotId=${botId}`,
    );
  });
});
