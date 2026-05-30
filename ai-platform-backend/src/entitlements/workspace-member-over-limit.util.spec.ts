import { isWorkspaceOverMemberLimit } from './workspace-member-over-limit.util';

describe('isWorkspaceOverMemberLimit', () => {
  it('returns true when active members exceed plan limit', () => {
    expect(isWorkspaceOverMemberLimit(8, 5)).toBe(true);
  });

  it('returns false when within limit', () => {
    expect(isWorkspaceOverMemberLimit(5, 5)).toBe(false);
    expect(isWorkspaceOverMemberLimit(4, 5)).toBe(false);
  });
});
