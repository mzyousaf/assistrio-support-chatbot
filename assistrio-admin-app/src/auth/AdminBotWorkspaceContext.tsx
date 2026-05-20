import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import { getAdminBot, patchAdminBot } from '@/api/adminApi';
import type { AdminBotWorkspaceBot } from '@/api/types';

export type AdminBotWorkspaceLoadState = 'loading' | 'ok' | 'not_found' | 'forbidden' | 'error';

type AdminBotWorkspaceValue = {
  botId: string | undefined;
  bot: AdminBotWorkspaceBot | null;
  health: Record<string, unknown> | null;
  loadState: AdminBotWorkspaceLoadState;
  loadMessage: string;
  reload: () => Promise<void>;
  softReload: () => Promise<void>;
  patchBot: (body: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const AdminBotWorkspaceContext = createContext<AdminBotWorkspaceValue | null>(null);

export function AdminBotWorkspaceProvider({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [bot, setBot] = useState<AdminBotWorkspaceBot | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loadState, setLoadState] = useState<AdminBotWorkspaceLoadState>('loading');
  const [loadMessage, setLoadMessage] = useState('');

  const idRef = useRef<string | undefined>(id);
  idRef.current = id;
  const loadedBotIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    loadedBotIdRef.current = bot?.id;
  }, [bot?.id]);

  const reloadFlightRef = useRef<{ id: string; promise: Promise<void> } | null>(null);
  const softReloadFlightRef = useRef<{ id: string; promise: Promise<void> } | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setLoadState('error');
      setLoadMessage('Missing bot id.');
      setBot(null);
      setHealth(null);
      return;
    }

    const inflight = reloadFlightRef.current;
    if (inflight?.id === id) {
      await inflight.promise;
      return;
    }

    const capturedId = id;
    if (loadedBotIdRef.current !== capturedId) {
      setLoadState('loading');
      setLoadMessage('');
    }

    const promise = (async () => {
      const res = await getAdminBot(capturedId);
      if (idRef.current !== capturedId) return;
      if (!res.ok) {
        setBot(null);
        setHealth(null);
        if (res.status === 404) {
          setLoadState('not_found');
          setLoadMessage('Bot not found');
        } else if (res.status === 403) {
          setLoadState('forbidden');
          setLoadMessage('You do not have access to this bot');
        } else {
          setLoadState('error');
          setLoadMessage(res.error);
        }
        return;
      }
      setBot(res.data.bot as AdminBotWorkspaceBot);
      setHealth((res.data.health as Record<string, unknown>) ?? null);
      setLoadState('ok');
    })().finally(() => {
      if (reloadFlightRef.current?.promise === promise) reloadFlightRef.current = null;
    });

    reloadFlightRef.current = { id: capturedId, promise };
    await promise;
  }, [id]);

  const softReload = useCallback(async () => {
    if (!id) return;
    const inflight = softReloadFlightRef.current;
    if (inflight?.id === id) {
      await inflight.promise;
      return;
    }
    const capturedId = id;
    const promise = (async () => {
      const res = await getAdminBot(capturedId);
      if (idRef.current !== capturedId || !res.ok) return;
      setBot(res.data.bot as AdminBotWorkspaceBot);
      setHealth((res.data.health as Record<string, unknown>) ?? null);
      setLoadState('ok');
    })().finally(() => {
      if (softReloadFlightRef.current?.promise === promise) softReloadFlightRef.current = null;
    });
    softReloadFlightRef.current = { id: capturedId, promise };
    await promise;
  }, [id]);

  const patchBot = useCallback(
    async (body: Record<string, unknown>) => {
      if (!id) return { ok: false as const, error: 'Missing bot id' };
      const res = await patchAdminBot(id, body);
      if (!res.ok) return { ok: false as const, error: res.error };
      await softReload();
      return { ok: true as const };
    },
    [id, softReload],
  );

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
      softReload,
      patchBot,
    }),
    [id, bot, health, loadState, loadMessage, reload, softReload, patchBot],
  );

  return <AdminBotWorkspaceContext.Provider value={value}>{children}</AdminBotWorkspaceContext.Provider>;
}

export function useAdminBotWorkspace(): AdminBotWorkspaceValue {
  const ctx = useContext(AdminBotWorkspaceContext);
  if (!ctx) {
    throw new Error('useAdminBotWorkspace must be used within AdminBotWorkspaceProvider');
  }
  return ctx;
}
