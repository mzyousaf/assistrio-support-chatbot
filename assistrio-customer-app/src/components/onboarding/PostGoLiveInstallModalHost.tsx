import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { YouAreLiveModal } from '@/components/onboarding/YouAreLiveModal';
import { useGoLivePublishOverlay } from '@/onboarding/goLivePublishOverlay';

export const POST_GO_LIVE_INSTALL_BOT_SESSION_KEY = 'assistrio_post_go_live_install_bot_id';

export function persistPostGoLiveInstallBotId(botId: string): void {
  const trimmed = botId.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY, trimmed);
  } catch {
    /* ignore storage errors */
  }
}

/** Opens the install snippet modal from URL params or a sessionStorage fallback after onboarding go-live. */
export function PostGoLiveInstallModalHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessionBotId, setSessionBotId] = useState<string | null>(null);
  const { clearPublishSuccessOverlay } = useGoLivePublishOverlay();

  const showInstall = searchParams.get('showInstall') === '1';
  const urlBotId = searchParams.get('liveBotId')?.trim() || null;
  const liveBotId = urlBotId ?? sessionBotId;

  useEffect(() => {
    if (showInstall && urlBotId) {
      try {
        sessionStorage.removeItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY);
      } catch {
        /* ignore storage errors */
      }
      return;
    }
    try {
      const stored = sessionStorage.getItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY)?.trim();
      if (!stored) return;
      sessionStorage.removeItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY);
      setSessionBotId(stored);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('liveBotId', stored);
          next.set('showInstall', '1');
          return next;
        },
        { replace: true },
      );
    } catch {
      /* ignore storage errors */
    }
  }, [setSearchParams, showInstall, urlBotId]);

  const liveModalOpen = useMemo(
    () => Boolean(liveBotId && (showInstall || sessionBotId !== null)),
    [liveBotId, showInstall, sessionBotId],
  );

  useEffect(() => {
    if (liveModalOpen) {
      clearPublishSuccessOverlay();
    }
  }, [clearPublishSuccessOverlay, liveModalOpen]);

  const closeLiveModal = useCallback(() => {
    setSessionBotId(null);
    try {
      sessionStorage.removeItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY);
    } catch {
      /* ignore storage errors */
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('showInstall');
        next.delete('liveBotId');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return <YouAreLiveModal open={liveModalOpen} botId={liveBotId} onClose={closeLiveModal} />;
}
