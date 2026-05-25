import { Types } from 'mongoose';

/** Mirrors scripts/backfill-workspace-owner-role.js selection logic for unit tests. */
function membershipCreatedAt(membership: { _id: Types.ObjectId }) {
  return membership._id.getTimestamp();
}

function pickEarliestMembership<T extends { _id: Types.ObjectId }>(memberships: T[]): T | null {
  if (!memberships.length) return null;
  return [...memberships].sort((a, b) => membershipCreatedAt(a).getTime() - membershipCreatedAt(b).getTime())[0] ?? null;
}

function selectMembershipForOwnerPromotion(
  rows: Array<{ _id: Types.ObjectId; role: string; userId: Types.ObjectId }>,
) {
  if (!rows.length) return null;
  if (rows.some((row) => row.role === 'owner')) return null;
  const admins = rows.filter((row) => row.role === 'admin');
  return pickEarliestMembership(admins.length ? admins : rows);
}

describe('backfill workspace owner selection', () => {
  it('skips when owner already exists', () => {
    const rows = [
      { _id: new Types.ObjectId('507f1f77bcf86cd799439001'), role: 'owner', userId: new Types.ObjectId() },
      { _id: new Types.ObjectId('507f1f77bcf86cd799439002'), role: 'admin', userId: new Types.ObjectId() },
    ];
    expect(selectMembershipForOwnerPromotion(rows)).toBeNull();
  });

  it('promotes earliest admin by membership _id timestamp', () => {
    const earlyAdmin = Types.ObjectId.createFromTime(1_000);
    const lateAdmin = Types.ObjectId.createFromTime(2_000);
    const rows = [
      { _id: lateAdmin, role: 'admin', userId: new Types.ObjectId() },
      { _id: earlyAdmin, role: 'admin', userId: new Types.ObjectId() },
      { _id: Types.ObjectId.createFromTime(500), role: 'member', userId: new Types.ObjectId() },
    ];
    expect(selectMembershipForOwnerPromotion(rows)?._id).toEqual(earlyAdmin);
  });

  it('promotes earliest member when no admin exists', () => {
    const early = Types.ObjectId.createFromTime(1_000);
    const late = Types.ObjectId.createFromTime(2_000);
    const rows = [
      { _id: late, role: 'member', userId: new Types.ObjectId() },
      { _id: early, role: 'member', userId: new Types.ObjectId() },
    ];
    expect(selectMembershipForOwnerPromotion(rows)?._id).toEqual(early);
  });
});
