import { createContext, useContext, type ReactNode } from 'react';

export type BotLifecycleControls = {
  openPublish: () => void;
  openDraft: () => void;
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
