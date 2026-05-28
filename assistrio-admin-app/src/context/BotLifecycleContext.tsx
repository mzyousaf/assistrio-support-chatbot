import { createContext, useContext, type ReactNode } from 'react';

export type BotLifecycleAction = 'publish' | 'draft';

export type BotLifecycleControls = {
  openPublish: () => void;
  openDraft: () => void;
  busy: boolean;
  action: BotLifecycleAction | null;
  optimisticStatus: 'draft' | 'published' | null;
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
