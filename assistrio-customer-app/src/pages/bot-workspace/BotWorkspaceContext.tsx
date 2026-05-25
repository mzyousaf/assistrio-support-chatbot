import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustomerBot } from '../../api/customerApi';
import type { CustomerBotDetail } from '../../api/types';
import { useCustomerAuth } from '../../auth/CustomerAuthContext';
import { canManageActiveWorkspace } from '../../lib/canManageActiveWorkspace';
import { ASSISTRIO_WORKSPACE_BOT_REFRESH, requestNavbarBotRefresh } from '../../lib/botSyncEvents';
import { isCustomerResourceUnavailable, MSG_DELETED_BOT } from '../../lib/customerResourceUnavailable';
import { WORKSPACE_BOT_ACCESS_DENIED_MESSAGE, WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE, isWorkspaceBotAccessDenied, isWorkspaceBotPreviewAccessDenied } from '../../lib/botsListMessages';
import { appToast } from '@/lib/app-toast';

export type BotWorkspaceLoadState = 'loading' | 'ok' | 'not_found' | 'forbidden' | 'error';

type BotWorkspaceValue = {
  botId: string | undefined;
  bot: CustomerBotDetail | null;
  health: Record<string, unknown> | null;
  loadState: BotWorkspaceLoadState;
  loadMessage: string;
  canManageBot: boolean;
  reload: () => Promise<void>;
  /** Refetch bot + health without setting `loadState` to loading (use after PATCH saves). */
  softReload: () => Promise<void>;
};

const BotWorkspaceContext = createContext<BotWorkspaceValue | null>(null);

export function BotWorkspaceProvider({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { customer } = useCustomerAuth();
  const canManageBot = canManageActiveWorkspace(customer);
  const [bot, setBot] = useState<CustomerBotDetail | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loadState, setLoadState] = useState<BotWorkspaceLoadState>('loading');
  const [loadMessage, setLoadMessage] = useState('');

  /** Latest route param — avoids applying a stale fetch after rapid assistant switches. */
  const idRef = useRef<string | undefined>(id);
  idRef.current = id;

  /** Last assistant id we successfully rendered (for stale-while-revalidate / duplicate effect dedupe). */
  const loadedBotIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    loadedBotIdRef.current = bot?.id;
  }, [bot?.id]);

  const reloadFlightRef = useRef<{ id: string; promise: Promise<void> } | null>(null);
  const softReloadFlightRef = useRef<{ id: string; promise: Promise<void> } | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setLoadState('error');
      setLoadMessage('Missing assistant id.');
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

    // Only blank the workspace when switching assistants or first load — keeps playground widget mounted on same-id refetches (e.g. duplicate effects).
    if (loadedBotIdRef.current !== capturedId) {
      setLoadState('loading');
      setLoadMessage('');
    }

    const promise = (async () => {
      const res = await getCustomerBot(capturedId);
      if (idRef.current !== capturedId) return;

      if (!res.ok) {
        setBot(null);
        setHealth(null);
        if (isCustomerResourceUnavailable(res)) {
          appToast.error(MSG_DELETED_BOT);
          void navigate('/bots', { replace: true });
          setLoadState('not_found');
          setLoadMessage(MSG_DELETED_BOT);
          return;
        }
        if (res.status === 403) {
          const previewDenied = isWorkspaceBotPreviewAccessDenied(res);
          const accessDenied = isWorkspaceBotAccessDenied(res);
          const msg = previewDenied
            ? WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE
            : accessDenied
              ? WORKSPACE_BOT_ACCESS_DENIED_MESSAGE
              : res.error || "You don't have access to this assistant.";
          if (previewDenied) appToast.error(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE);
          else if (accessDenied) appToast.error(WORKSPACE_BOT_ACCESS_DENIED_MESSAGE);
          setLoadState('forbidden');
          setLoadMessage(msg);
        } else {
          setLoadState('error');
          setLoadMessage(res.error);
        }
        return;
      }
      setBot(res.data.bot as CustomerBotDetail);
      setHealth(res.data.health as Record<string, unknown>);
      setLoadState('ok');
    })().finally(() => {
      if (reloadFlightRef.current?.promise === promise) reloadFlightRef.current = null;
    });

    reloadFlightRef.current = { id: capturedId, promise };
    await promise;
  }, [id, navigate]);

  const softReload = useCallback(async () => {
    if (!id) return;

    const inflight = softReloadFlightRef.current;
    if (inflight?.id === id) {
      await inflight.promise;
      return;
    }

    const capturedId = id;

    const promise = (async () => {
      const res = await getCustomerBot(capturedId);
      if (idRef.current !== capturedId) return;

      if (!res.ok) {
        if (isCustomerResourceUnavailable(res)) {
          setBot(null);
          setHealth(null);
          setLoadState('not_found');
          setLoadMessage(MSG_DELETED_BOT);
          appToast.error(MSG_DELETED_BOT);
          void navigate('/bots', { replace: true });
        }
        return;
      }
      setBot(res.data.bot as CustomerBotDetail);
      setHealth(res.data.health as Record<string, unknown>);
      setLoadState((prev) => (prev === 'loading' ? prev : 'ok'));
      requestNavbarBotRefresh(capturedId);
    })().finally(() => {
      if (softReloadFlightRef.current?.promise === promise) softReloadFlightRef.current = null;
    });

    softReloadFlightRef.current = { id: capturedId, promise };
    await promise;
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    const onShellRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ botId?: string }>).detail;
      if (detail?.botId === id) void softReload();
    };
    window.addEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onShellRefresh);
    return () => window.removeEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onShellRefresh);
  }, [id, softReload]);

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
      canManageBot,
      reload,
      softReload,
    }),
    [id, bot, health, loadState, loadMessage, canManageBot, reload, softReload],
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

export function useCanManageBot(): boolean {
  return useBotWorkspace().canManageBot;
}
