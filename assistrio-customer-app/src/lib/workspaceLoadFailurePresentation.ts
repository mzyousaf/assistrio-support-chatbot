import type { BotWorkspaceLoadState } from '@/pages/bot-workspace/BotWorkspaceContext';
import type { WorkspaceLoadFailureIconKind } from '@/components/WorkspaceLoadFailureCard';

export function isLikelyNetworkFailureMessage(message: string): boolean {
  const m = (message || '').trim().toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('load failed') ||
    m === 'fetcherror'
  );
}

export function resolveBotWorkspaceFailurePresentation(
  state: Extract<BotWorkspaceLoadState, 'not_found' | 'forbidden' | 'error'>,
  message: string,
): { title: string; description: string; icon: WorkspaceLoadFailureIconKind } {
  const m = (message || '').trim();

  if (state === 'forbidden') {
    return {
      title: "You can't open this assistant",
      description: m || 'Your account does not have access. Ask an admin if you need permission.',
      icon: 'forbidden',
    };
  }

  if (state === 'not_found') {
    return {
      title: 'Assistant not found',
      description: m || 'It may have been deleted or the link is wrong.',
      icon: 'not_found',
    };
  }

  if (isLikelyNetworkFailureMessage(m)) {
    return {
      title: "We couldn't load this assistant",
      description:
        'Your browser could not reach our servers. Check your connection, wait a moment, and try again. VPNs and some corporate networks block requests.',
      icon: 'network',
    };
  }

  return {
    title: 'Something went wrong',
    description: m || 'We could not load this assistant. Please try again.',
    icon: 'generic',
  };
}

/** Iframe chat bootstrap (`/iframe/:botId`) — same messaging pattern as the assistant workspace, with “chat” wording. */
export function resolveIframeChatFailurePresentation(
  errorText: string,
  isOriginBlocked: boolean,
): { title: string; description: string; icon: WorkspaceLoadFailureIconKind } {
  const m = (errorText || '').trim();

  if (isOriginBlocked) {
    return {
      title: 'This chatbot is not allowed on this site',
      description:
        m ||
        'Add your site’s origin under Allowed origins in Deploy & Go Live, then try again.',
      icon: 'forbidden',
    };
  }

  if (isLikelyNetworkFailureMessage(m)) {
    return {
      title: "We couldn't load this chat",
      description:
        'Your browser could not reach our servers. Check your connection, wait a moment, and try again. VPNs and some corporate networks block requests.',
      icon: 'network',
    };
  }

  return {
    title: 'Something went wrong',
    description: m || 'We could not load this chat. Please try again.',
    icon: 'generic',
  };
}
