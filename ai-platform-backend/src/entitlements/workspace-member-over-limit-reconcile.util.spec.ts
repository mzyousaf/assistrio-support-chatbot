import {
  compareMemberSeatOrder,
  normalizeMembershipStatus,
  resolveDesiredMemberStatuses,
  type MemberSeatRecord,
} from './workspace-member-over-limit-reconcile.util';

describe('workspace-member-over-limit-reconcile.util', () => {
  const owner: MemberSeatRecord = {
    membershipId: 'm-owner',
    userId: 'u-owner',
    role: 'owner',
    status: 'active',
    joinedAt: new Date('2024-01-01'),
  };

  function member(id: string, joinedAt: string, status: 'active' | 'inactive_over_limit' = 'active'): MemberSeatRecord {
    return {
      membershipId: id,
      userId: `u-${id}`,
      role: 'member',
      status,
      joinedAt: new Date(joinedAt),
    };
  }

  it('keeps owner active and oldest non-owners up to limit', () => {
    const members = [
      owner,
      member('m1', '2024-02-01'),
      member('m2', '2024-03-01'),
      member('m3', '2024-04-01'),
      member('m4', '2024-05-01'),
      member('m5', '2024-06-01'),
    ];

    const plan = resolveDesiredMemberStatuses(members, 5);

    expect(plan.get('m-owner')).toBe('active');
    expect(plan.get('m1')).toBe('active');
    expect(plan.get('m2')).toBe('active');
    expect(plan.get('m3')).toBe('active');
    expect(plan.get('m4')).toBe('active');
    expect(plan.get('m5')).toBe('inactive_over_limit');
  });

  it('free limit 1 leaves only owner active', () => {
    const members = [owner, member('m1', '2024-02-01'), member('m2', '2024-03-01')];
    const plan = resolveDesiredMemberStatuses(members, 1);
    expect(plan.get('m-owner')).toBe('active');
    expect(plan.get('m1')).toBe('inactive_over_limit');
    expect(plan.get('m2')).toBe('inactive_over_limit');
  });

  it('reactivation order prefers oldest inactive when limit increases', () => {
    const members = [
      owner,
      member('m1', '2024-02-01', 'inactive_over_limit'),
      member('m2', '2024-03-01', 'inactive_over_limit'),
      member('m3', '2024-04-01', 'active'),
    ];
    const plan = resolveDesiredMemberStatuses(members, 10);
    expect(plan.get('m1')).toBe('active');
    expect(plan.get('m2')).toBe('active');
    expect(plan.get('m3')).toBe('active');
  });

  it('compareMemberSeatOrder breaks ties by membership id', () => {
    const a = member('a', '2024-01-01');
    const b = member('b', '2024-01-01');
    expect(compareMemberSeatOrder(a, b)).toBeLessThan(0);
  });

  it('normalizeMembershipStatus treats unknown as active', () => {
    expect(normalizeMembershipStatus(undefined)).toBe('active');
    expect(normalizeMembershipStatus('inactive_over_limit')).toBe('inactive_over_limit');
  });
});
