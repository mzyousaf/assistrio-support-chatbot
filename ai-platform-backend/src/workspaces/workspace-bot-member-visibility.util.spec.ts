import {
  botHasWorkspaceScope,
  isBotMemberPreviewAllowed,
  isBotVisibleToWorkspaceMembers,
  resolveBotWorkspaceMemberVisibility,
} from './workspace-bot-member-visibility.util';

describe('workspace-bot-member-visibility.util', () => {
  it('defaults to visible and preview allowed', () => {
    expect(resolveBotWorkspaceMemberVisibility({})).toEqual({
      visibleToMembers: true,
      allowMemberPreview: true,
    });
  });

  it('respects explicit false flags', () => {
    const bot = { workspaceMemberVisibility: { visibleToMembers: false, allowMemberPreview: false } };
    expect(isBotVisibleToWorkspaceMembers(bot)).toBe(false);
    expect(isBotMemberPreviewAllowed(bot)).toBe(false);
  });

  it('detects workspace scope from workspaceId', () => {
    expect(botHasWorkspaceScope({})).toBe(false);
    expect(botHasWorkspaceScope({ workspaceId: '' })).toBe(false);
    expect(botHasWorkspaceScope({ workspaceId: '507f1f77bcf86cd799439011' })).toBe(true);
  });
});
