import { describe, expect, it } from 'vitest';
import type { CustomerBotListItem } from '@/api/types';
import {
  buildInviteBotGrants,
  clearInviteBotAccess,
  emptyInviteBotAccessState,
  grantInvitePreviewAll,
  grantInviteViewAll,
  updateInviteBotAccess,
} from './inviteMemberBotAccess.util';

const bots: CustomerBotListItem[] = [
  {
    _id: 'bot-1',
    name: 'Agent One',
    agentsPackAgent: false,
    category: 'general',
    status: 'published',
    isPublic: true,
    visibility: 'public',
    createdAt: null,
    slug: 'one',
    primaryColor: '#14B8A6',
    workspaceId: 'ws-1',
  },
  {
    _id: 'bot-2',
    name: 'Agent Two',
    agentsPackAgent: false,
    category: 'general',
    status: 'draft',
    isPublic: false,
    visibility: 'private',
    createdAt: null,
    slug: 'two',
    primaryColor: '#0d9488',
    workspaceId: 'ws-1',
  },
];

describe('inviteMemberBotAccess.util', () => {
  it('defaults to no access', () => {
    expect(emptyInviteBotAccessState(bots)).toEqual({
      'bot-1': { canView: false, canPreview: false },
      'bot-2': { canView: false, canPreview: false },
    });
  });

  it('turning preview on enables view', () => {
    let state = emptyInviteBotAccessState(bots);
    state = updateInviteBotAccess(state, 'bot-1', { canPreview: true });
    expect(state['bot-1']).toEqual({ canView: true, canPreview: true });
  });

  it('turning view off disables preview', () => {
    let state = grantInvitePreviewAll(bots);
    state = updateInviteBotAccess(state, 'bot-1', { canView: false });
    expect(state['bot-1']).toEqual({ canView: false, canPreview: false });
  });

  it('grant view all and preview all helpers', () => {
    expect(grantInviteViewAll(bots)['bot-1']).toEqual({ canView: true, canPreview: false });
    expect(grantInvitePreviewAll(bots)['bot-2']).toEqual({ canView: true, canPreview: true });
    expect(clearInviteBotAccess(bots)).toEqual(emptyInviteBotAccessState(bots));
  });

  it('buildInviteBotGrants omits empty grants', () => {
    let state = emptyInviteBotAccessState(bots);
    state = updateInviteBotAccess(state, 'bot-1', { canView: true });
    state = updateInviteBotAccess(state, 'bot-2', { canView: true, canPreview: true });
    expect(buildInviteBotGrants(state)).toEqual([
      { botId: 'bot-1', canView: true, canPreview: false },
      { botId: 'bot-2', canView: true, canPreview: true },
    ]);
    expect(buildInviteBotGrants(emptyInviteBotAccessState(bots))).toEqual([]);
  });
});
