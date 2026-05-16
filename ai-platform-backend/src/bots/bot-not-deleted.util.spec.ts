import { botIsEffectivelyDeleted, botNotDeletedClause } from './bot-not-deleted.util';

describe('bot-not-deleted.util', () => {
  it('botNotDeletedClause matches live rows (legacy without active still live)', () => {
    const c = botNotDeletedClause() as { $and: unknown[] };
    expect(c.$and).toBeDefined();
    expect(c.$and.length).toBeGreaterThanOrEqual(2);
  });

  it('botIsEffectivelyDeleted is true when active is false or deletedAt set', () => {
    expect(botIsEffectivelyDeleted(null)).toBe(true);
    expect(botIsEffectivelyDeleted({ active: false })).toBe(true);
    expect(botIsEffectivelyDeleted({ active: true, deletedAt: new Date() })).toBe(true);
    expect(botIsEffectivelyDeleted({ active: true, deletedAt: null })).toBe(false);
    expect(botIsEffectivelyDeleted({})).toBe(false);
  });
});
