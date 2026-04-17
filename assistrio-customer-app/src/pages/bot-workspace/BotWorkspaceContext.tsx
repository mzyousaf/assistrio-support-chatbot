import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import { getCustomerBot } from '../../api/customerApi';
import type { CustomerBotDetail } from '../../api/types';

export type BotWorkspaceLoadState = 'loading' | 'ok' | 'not_found' | 'forbidden' | 'error';

type BotWorkspaceValue = {
  botId: string | undefined;
  bot: CustomerBotDetail | null;
  health: Record<string, unknown> | null;
  loadState: BotWorkspaceLoadState;
  loadMessage: string;
  reload: () => Promise<void>;
};

const BotWorkspaceContext = createContext<BotWorkspaceValue | null>(null);

export function BotWorkspaceProvider({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [bot, setBot] = useState<CustomerBotDetail | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loadState, setLoadState] = useState<BotWorkspaceLoadState>('loading');
  const [loadMessage, setLoadMessage] = useState('');

  const reload = useCallback(async () => {
    if (!id) {
      setLoadState('error');
      setLoadMessage('Missing assistant id.');
      setBot(null);
      setHealth(null);
      return;
    }
    setLoadState('loading');
    setLoadMessage('');
    const res = await getCustomerBot(id);
    if (!res.ok) {
      setBot(null);
      setHealth(null);
      if (res.status === 404) {
        setLoadState('not_found');
        setLoadMessage('This assistant could not be found.');
      } else if (res.status === 403) {
        setLoadState('forbidden');
        setLoadMessage("You don't have access to this assistant.");
      } else {
        setLoadState('error');
        setLoadMessage(res.error);
      }
      return;
    }
    setBot(res.data.bot as CustomerBotDetail);
    setHealth(res.data.health as Record<string, unknown>);
    setLoadState('ok');
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({
      botId: id,
      bot,
      health,
      loadState,
      loadMessage,
      reload,
    }),
    [id, bot, health, loadState, loadMessage, reload],
  );

  return <BotWorkspaceContext.Provider value={value}>{children}</BotWorkspaceContext.Provider>;
}

export function useBotWorkspace() {
  const ctx = useContext(BotWorkspaceContext);
  if (!ctx) {
    throw new Error('useBotWorkspace must be used within BotWorkspaceProvider');
  }
  return ctx;
}
