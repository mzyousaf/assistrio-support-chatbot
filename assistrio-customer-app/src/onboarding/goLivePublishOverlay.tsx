import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BotLifecycleModal } from '@/components/BotLifecycleModal';

export type PinnedGoLiveDashboardNavigation = {
  botId: string;
};

type GoLivePublishOverlayContextValue = {
  pinDashboardNavigation: (state: PinnedGoLiveDashboardNavigation) => void;
  clearPublishSuccessOverlay: () => void;
  dashboardNavigationPinned: boolean;
};

const GoLivePublishOverlayContext = createContext<GoLivePublishOverlayContextValue | null>(null);

/** Keeps the go-live progress modal mounted across onboarding → dashboard navigation. */
export function GoLivePublishOverlayProvider({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState<PinnedGoLiveDashboardNavigation | null>(null);

  const pinDashboardNavigation = useCallback((state: PinnedGoLiveDashboardNavigation) => {
    setPinned(state);
  }, []);

  const clearPublishSuccessOverlay = useCallback(() => {
    setPinned(null);
  }, []);

  const value = useMemo(
    () => ({
      pinDashboardNavigation,
      clearPublishSuccessOverlay,
      dashboardNavigationPinned: pinned != null,
    }),
    [clearPublishSuccessOverlay, pinDashboardNavigation, pinned],
  );

  return (
    <GoLivePublishOverlayContext.Provider value={value}>
      {children}
      {pinned ? (
        <BotLifecycleModal
          open
          runKey={0}
          action="publish"
          botId={pinned.botId}
          navigateToDashboardAfterPublish
          initialDashboardNavigation
          onClose={() => {}}
          onSuccess={() => {}}
        />
      ) : null}
    </GoLivePublishOverlayContext.Provider>
  );
}

export function useGoLivePublishOverlay() {
  const ctx = useContext(GoLivePublishOverlayContext);
  if (!ctx) {
    throw new Error('useGoLivePublishOverlay must be used within GoLivePublishOverlayProvider');
  }
  return ctx;
}
