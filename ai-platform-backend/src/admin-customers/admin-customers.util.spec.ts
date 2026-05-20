import { Types } from 'mongoose';
import {
  accessibleBotsMatchForCustomer,
  customerDisplayName,
  escapeRegexLiteral,
  parsePaginationQuery,
} from './admin-customers.util';

describe('admin-customers.util', () => {
  it('parsePaginationQuery clamps page and limit', () => {
    expect(parsePaginationQuery('2', '50')).toEqual({ page: 2, limit: 50, skip: 50 });
    expect(parsePaginationQuery(undefined, '500').limit).toBe(100);
    expect(parsePaginationQuery('0', '0').page).toBe(1);
  });

  it('escapeRegexLiteral escapes metacharacters', () => {
    expect(escapeRegexLiteral('a+b')).toBe('a\\+b');
  });

  it('customerDisplayName prefers profile name then email local part', () => {
    expect(customerDisplayName({ email: 'j@x.com', firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
    expect(customerDisplayName({ email: 'jane@x.com' })).toBe('jane');
  });

  it('accessibleBotsMatchForCustomer includes workspace and legacy owner paths', () => {
    const uid = new Types.ObjectId();
    const ws = new Types.ObjectId();
    const match = accessibleBotsMatchForCustomer(uid, [ws]);
    expect(match).toHaveProperty('$or');
    expect(Array.isArray((match as { $or: unknown[] }).$or)).toBe(true);
  });
});
