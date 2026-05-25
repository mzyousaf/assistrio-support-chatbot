import type { ReactNode } from 'react';
import { useCanManageBot } from '@/pages/bot-workspace/BotWorkspaceContext';

export function AdminOnlyGate({ children }: { children: ReactNode }) {
  const canManageBot = useCanManageBot();
  if (!canManageBot) return null;
  return <>{children}</>;
}
