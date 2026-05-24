import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { YouAreLiveModal } from '@/components/onboarding/YouAreLiveModal';
import { useGoLivePublishOverlay } from '@/onboarding/goLivePublishOverlay';
import {
  clearPostGoLiveInstallModalIntent,
  postGoLiveInstallIntentMatchesRoute,
  readPostGoLiveInstallModalIntent,
} from '@/routes/postGoLiveInstallModalStorage';

export {
  persistPostGoLiveInstallBotId,
  persistPostGoLiveInstallModalIntent,
  POST_GO_LIVE_INSTALL_BOT_SESSION_KEY,
  POST_GO_LIVE_INSTALL_MODAL_SESSION_KEY,
} from '@/routes/postGoLiveInstallModalStorage';

/** Opens the install snippet modal from URL params or sessionStorage after onboarding go-live. */
export function PostGoLiveInstallModalHost() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clearPublishSuccessOverlay } = useGoLivePublishOverlay();
  const restoredParamsRef = useRef(false);

  const showInstall = searchParams.get('showInstall') === '1';
  const urlBotId = searchParams.get('liveBotId')?.trim() || null;

  const sessionIntent = useMemo(
    () => readPostGoLiveInstallModalIntent(),
    [location.pathname, location.search, showInstall, urlBotId],
  );

  const intentMatchesRoute = useMemo(
    () => (sessionIntent ? postGoLiveInstallIntentMatchesRoute(sessionIntent, location.pathname) : false),
    [sessionIntent, location.pathname],
  );

  const liveBotId = urlBotId ?? (intentMatchesRoute ? sessionIntent?.botId ?? null : null);

  const liveModalOpen = Boolean(
    liveBotId && ((showInstall && urlBotId) || (intentMatchesRoute && sessionIntent?.botId === liveBotId)),
  );

  useEffect(() => {
    if (!liveModalOpen) return;
    clearPublishSuccessOverlay();
  }, [clearPublishSuccessOverlay, liveModalOpen]);

  useEffect(() => {
    if (showInstall && urlBotId) {
      restoredParamsRef.current = false;
      return;
    }
    if (!sessionIntent || !intentMatchesRoute || restoredParamsRef.current) return;

    restoredParamsRef.current = true;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('liveBotId', sessionIntent.botId);
        next.set('showInstall', '1');
        return next;
      },
      { replace: true },
    );
  }, [
    intentMatchesRoute,
    sessionIntent,
    setSearchParams,
    showInstall,
    urlBotId,
  ]);

  const closeLiveModal = useCallback(() => {
    restoredParamsRef.current = false;
    clearPostGoLiveInstallModalIntent();
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
