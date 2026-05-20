import { adminAnalyticsBotOwnershipFields } from './admin-analytics-bot-fields.util';

describe('adminAnalyticsBotOwnershipFields', () => {
  it('maps platform bot type when isPlatformBot', () => {
    expect(
      adminAnalyticsBotOwnershipFields({
        isPlatformBot: true,
        platformBotType: 'showcase',
        workspaceId: '507f1f77bcf86cd799439011',
        ownerId: '507f1f77bcf86cd799439012',
      }),
    ).toEqual({
      isPlatformBot: true,
      platformBotType: 'showcase',
      workspaceId: '507f1f77bcf86cd799439011',
      ownerId: '507f1f77bcf86cd799439012',
    });
  });

  it('nulls platformBotType for tenant bots', () => {
    expect(
      adminAnalyticsBotOwnershipFields({
        isPlatformBot: false,
        platformBotType: 'showcase',
      }).platformBotType,
    ).toBeNull();
  });
});
