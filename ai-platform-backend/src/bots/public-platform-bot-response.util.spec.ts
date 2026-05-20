import {
  shapePublicPlatformBot,
  shapePublicPlatformBotDetailResponse,
  shapePublicPlatformBotListResponse,
} from './public-platform-bot-response.util';

const publishedPlatformBot = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Demo Bot',
  description: 'Helps visitors on the landing page.',
  platformBotType: 'landing_demo',
  isPlatformBot: true,
  status: 'published',
  visibility: 'public',
  isPublic: true,
  accessKey: 'ak_test_123',
  slug: 'demo-bot',
  imageUrl: 'https://cdn.example/avatar.png',
  welcomeMessage: 'Hello!',
  welcomeMessageEnabled: true,
  exampleQuestions: ['What do you do?', { label: 'Pricing?' }],
  createdAt: new Date('2026-01-15T12:00:00.000Z'),
};

describe('public-platform-bot-response.util', () => {
  it('shapes published public platform bots and omits non-public rows', () => {
    const shaped = shapePublicPlatformBot(publishedPlatformBot as Record<string, unknown>);
    expect(shaped).toMatchObject({
      id: '507f1f77bcf86cd799439011',
      name: 'Demo Bot',
      platformBotType: 'landing_demo',
      status: 'published',
      visibility: 'public',
      accessKey: 'ak_test_123',
      publicSlug: 'demo-bot',
      greeting: 'Hello!',
    });
    expect(shaped?.suggestedQuestions).toEqual(['What do you do?', 'Pricing?']);

    expect(
      shapePublicPlatformBot({
        ...publishedPlatformBot,
        status: 'draft',
      } as Record<string, unknown>),
    ).toBeNull();

    expect(
      shapePublicPlatformBot({
        ...publishedPlatformBot,
        isPlatformBot: false,
      } as Record<string, unknown>),
    ).toBeNull();

    expect(
      shapePublicPlatformBot({
        ...publishedPlatformBot,
        platformBotType: 'internal',
        status: 'published',
      } as Record<string, unknown>),
    ).not.toBeNull();
  });

  it('wraps list and detail responses with ok: true', () => {
    const list = shapePublicPlatformBotListResponse([publishedPlatformBot as Record<string, unknown>]);
    expect(list).toEqual({ ok: true, bots: [expect.objectContaining({ name: 'Demo Bot' })] });

    const detail = shapePublicPlatformBotDetailResponse(publishedPlatformBot as Record<string, unknown>);
    expect(detail?.ok).toBe(true);
    expect(detail?.bot.name).toBe('Demo Bot');
  });
});
