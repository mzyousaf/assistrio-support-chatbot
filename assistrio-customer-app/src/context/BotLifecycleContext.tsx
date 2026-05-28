import { createContext, useContext, type ReactNode } from 'react';

export type BotLifecycleAction = 'publish' | 'draft';

export type BotLifecycleControls = {
  openPublish: () => void;
  openDraft: () => void;
  /** True while a publish/draft lifecycle modal run is in progress. */
  busy: boolean;
  action: BotLifecycleAction | null;
  /** Set as soon as the lifecycle API succeeds; cleared after workspace state catches up. */
  optimisticStatus: 'draft' | 'published' | null;
  /** Deploy page registers local publish readiness so Go Live is not blocked on stale navbar bot data. */
  setDeployPublishReady?: (ready: boolean | null) => void;
};

const BotLifecycleContext = createContext<BotLifecycleControls | null>(null);

export function BotLifecycleProvider({
  value,
  children,
}: {
  value: BotLifecycleControls;
  children: ReactNode;
}) {
  return <BotLifecycleContext.Provider value={value}>{children}</BotLifecycleContext.Provider>;
}

export function useBotLifecycleControls(): BotLifecycleControls | null {
  return useContext(BotLifecycleContext);
}
