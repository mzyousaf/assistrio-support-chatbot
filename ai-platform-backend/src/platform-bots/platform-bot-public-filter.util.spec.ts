import { buildPlatformBotPublicMongoFilter } from './platform-bot-public-filter.util';

describe('buildPlatformBotPublicMongoFilter', () => {
  it('requires published public platform bots and excludes internal by default', () => {
    const filter = buildPlatformBotPublicMongoFilter({});
    expect(filter.isPlatformBot).toBe(true);
    expect(filter.status).toBe('published');
    expect(filter.visibility).toBe('public');
    expect(filter.platformBotType).toEqual({ $ne: 'internal' });
  });

  it('allows explicit type including internal', () => {
    expect(buildPlatformBotPublicMongoFilter({ type: 'landing_demo' }).platformBotType).toBe(
      'landing_demo',
    );
    expect(buildPlatformBotPublicMongoFilter({ type: 'internal' }).platformBotType).toBe('internal');
  });
});
