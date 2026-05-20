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
import { StorageLimitModal, StorageLowWarningModal } from '@/components/knowledge/StorageLimitModal';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import {
  isPlanLimitBotKbTotalApiResult,
  KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE,
  knowledgeStorageIncreaseOutcome,
  storageLimitMessageFromApiError,
  type StorageLimitApiErrorInput,
} from '@/lib/knowledgeStorageLimits';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import type { AdminKnowledgeUsage } from '@/api/types';

export type KnowledgeStorageUxContextValue = {
  knowledgeUsage: AdminKnowledgeUsage | undefined;
  showStorageFullModal: (backendMessage?: string) => void;
  confirmLowStorageWarning: (message: string) => Promise<boolean>;
  /** When the API returned `plan_limit_bot_kb_total`, opens the modal, refreshes usage, returns true (skip generic toast). */
  notifyPlanLimitFromApi: (res: StorageLimitApiErrorInput) => boolean;
  /**
   * Before an action that adds `additionalUtf8Bytes` toward total storage: may open limit or low-storage modals.
   * Returns false when the user must not proceed (limit reached, or they cancelled the low-storage warning).
   */
  interceptKnowledgeStorageIncrease: (
    additionalUtf8Bytes: number,
    lowStorageMessage?: string,
  ) => Promise<boolean>;
  /**
   * Register a cleanup for when the user dismisses the storage limit modal or cancels the low-storage warning
   * (overlay / Cancel — not “Continue anyway”). Use for stacked confirm/import modals.
   */
  registerDismissWithStorageModals: (fn: () => void) => () => void;
};

const KnowledgeStorageUxContext = createContext<KnowledgeStorageUxContextValue | null>(null);

export function KnowledgeStorageUxProvider({ children }: { children: ReactNode }) {
  const { bot, botId, softReload } = useAdminBotWorkspace();
  const { refreshTrainingStatus } = useKbWorkspacePolling();
  const knowledgeUsage = bot?.knowledgeUsage as AdminKnowledgeUsage | undefined;

  const [fullOpen, setFullOpen] = useState(false);
  const [fullBackendMessage, setFullBackendMessage] = useState<string | undefined>(undefined);
  const [lowOpen, setLowOpen] = useState(false);
  const [lowMessage, setLowMessage] = useState('');
  const lowResolveRef = useRef<((continued: boolean) => void) | null>(null);
  const companionDismissRef = useRef(new Set<() => void>());

  const registerDismissWithStorageModals = useCallback((fn: () => void) => {
    companionDismissRef.current.add(fn);
    return () => {
      companionDismissRef.current.delete(fn);
    };
  }, []);

  const notifyCompanionsDismissed = useCallback(() => {
    for (const fn of [...companionDismissRef.current]) {
      try {
        fn();
      } catch {
        /* ignore listener errors */
      }
    }
  }, []);

  const refreshUsage = useCallback(async () => {
    await softReload();
    await refreshTrainingStatus();
    if (botId) requestWorkspaceBotRefresh(botId);
  }, [botId, softReload, refreshTrainingStatus]);

  const showStorageFullModal = useCallback(
    (backendMessage?: string) => {
      setFullBackendMessage(backendMessage);
      setFullOpen(true);
      void refreshUsage();
    },
    [refreshUsage],
  );

  const confirmLowStorageWarning = useCallback((message: string): Promise<boolean> => {
    setLowMessage(message);
    setLowOpen(true);
    return new Promise<boolean>((resolve) => {
      lowResolveRef.current = resolve;
    });
  }, []);

  const notifyPlanLimitFromApi = useCallback(
    (res: StorageLimitApiErrorInput): boolean => {
      if (!isPlanLimitBotKbTotalApiResult(res)) return false;
      const msg = storageLimitMessageFromApiError(res) ?? undefined;
      showStorageFullModal(msg);
      return true;
    },
    [showStorageFullModal],
  );

  const interceptKnowledgeStorageIncrease = useCallback(
    async (additionalUtf8Bytes: number, lowStorageMessage?: string): Promise<boolean> => {
      const outcome = knowledgeStorageIncreaseOutcome(knowledgeUsage, additionalUtf8Bytes);
      if (outcome === 'limit_modal') {
        showStorageFullModal();
        return false;
      }
      if (outcome === 'low_warn') {
        const msg = lowStorageMessage ?? KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE;
        return await confirmLowStorageWarning(msg);
      }
      return true;
    },
    [knowledgeUsage, showStorageFullModal, confirmLowStorageWarning],
  );

  const finishLow = useCallback(
    (continued: boolean) => {
      if (!continued) {
        notifyCompanionsDismissed();
      }
      setLowOpen(false);
      lowResolveRef.current?.(continued);
      lowResolveRef.current = null;
    },
    [notifyCompanionsDismissed],
  );

  const value = useMemo<KnowledgeStorageUxContextValue>(
    () => ({
      knowledgeUsage,
      showStorageFullModal,
      confirmLowStorageWarning,
      notifyPlanLimitFromApi,
      interceptKnowledgeStorageIncrease,
      registerDismissWithStorageModals,
    }),
    [
      knowledgeUsage,
      showStorageFullModal,
      confirmLowStorageWarning,
      notifyPlanLimitFromApi,
      interceptKnowledgeStorageIncrease,
      registerDismissWithStorageModals,
    ],
  );

  const safeBotId = botId ?? '';

  return (
    <KnowledgeStorageUxContext.Provider value={value}>
      {children}
      {safeBotId ? (
        <StorageLimitModal
          open={fullOpen}
          onClose={() => {
            notifyCompanionsDismissed();
            setFullOpen(false);
            setFullBackendMessage(undefined);
          }}
          botId={safeBotId}
          knowledgeUsage={knowledgeUsage}
          backendMessage={fullBackendMessage}
        />
      ) : null}
      <StorageLowWarningModal
        open={lowOpen}
        message={lowMessage}
        botId={botId ?? undefined}
        onContinue={() => finishLow(true)}
        onCancel={() => finishLow(false)}
      />
    </KnowledgeStorageUxContext.Provider>
  );
}

export function useKnowledgeStorageUx(): KnowledgeStorageUxContextValue {
  const ctx = useContext(KnowledgeStorageUxContext);
  if (!ctx) {
    throw new Error('useKnowledgeStorageUx must be used within KnowledgeStorageUxProvider');
  }
  return ctx;
}

/**
 * When the user closes the storage limit modal or cancels the low-storage warning (not Continue), runs `closeFn`.
 * Use to close stacked {@link KnowledgeSaveConfirmModal} / import dialogs.
 */
export function useDismissKnowledgeCompanionModalsOnStorageClose(closeFn: () => void) {
  const { registerDismissWithStorageModals } = useKnowledgeStorageUx();
  const closeRef = useRef(closeFn);
  closeRef.current = closeFn;
  useEffect(() => {
    return registerDismissWithStorageModals(() => {
      closeRef.current();
    });
  }, [registerDismissWithStorageModals]);
}
