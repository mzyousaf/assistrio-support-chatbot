import type { CustomerBotListItem } from '@/api/types';

export type InviteBotAccessEntry = {
  canView: boolean;
  canPreview: boolean;
};

export type InviteBotAccessState = Record<string, InviteBotAccessEntry>;

export function emptyInviteBotAccessState(bots: CustomerBotListItem[]): InviteBotAccessState {
  const out: InviteBotAccessState = {};
  for (const bot of bots) {
    out[bot._id] = { canView: false, canPreview: false };
  }
  return out;
}

export function updateInviteBotAccess(
  state: InviteBotAccessState,
  botId: string,
  patch: Partial<InviteBotAccessEntry>,
): InviteBotAccessState {
  const current = state[botId] ?? { canView: false, canPreview: false };
  let canView = patch.canView ?? current.canView;
  let canPreview = patch.canPreview ?? current.canPreview;
  if (patch.canPreview === true) canView = true;
  if (!canView) canPreview = false;
  else if (patch.canPreview != null) canPreview = patch.canPreview;
  return {
    ...state,
    [botId]: { canView, canPreview },
  };
}

export function grantInviteViewAll(bots: CustomerBotListItem[]): InviteBotAccessState {
  const out: InviteBotAccessState = {};
  for (const bot of bots) {
    out[bot._id] = { canView: true, canPreview: false };
  }
  return out;
}

export function grantInvitePreviewAll(bots: CustomerBotListItem[]): InviteBotAccessState {
  const out: InviteBotAccessState = {};
  for (const bot of bots) {
    out[bot._id] = { canView: true, canPreview: true };
  }
  return out;
}

export function clearInviteBotAccess(bots: CustomerBotListItem[]): InviteBotAccessState {
  return emptyInviteBotAccessState(bots);
}

/** Only grants with view or preview enabled (API payload). */
export function buildInviteBotGrants(state: InviteBotAccessState): Array<{
  botId: string;
  canView: boolean;
  canPreview: boolean;
}> {
  return Object.entries(state)
    .filter(([, flags]) => flags.canView || flags.canPreview)
    .map(([botId, flags]) => ({
      botId,
      canView: flags.canView,
      canPreview: flags.canPreview && flags.canView,
    }));
}
