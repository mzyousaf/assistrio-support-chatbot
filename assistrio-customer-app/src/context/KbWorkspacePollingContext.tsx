import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomerBotAgentTrainingStatus, getCustomerBotKnowledgeStatus } from '../api/customerApi';
import type {
  CustomerAgentTrainingStatusResponse,
  CustomerKnowledgeStatusItem,
} from '../api/types';
import {
  ASSISTRIO_WORKSPACE_BOT_REFRESH,
  KB_TRAINING_AFFECTED_ALL,
  type KbTrainingAffectedType,
  type WorkspaceBotRefreshDetail,
} from '@/lib/botSyncEvents';
import { knowledgeDocumentsListCache } from '@/pages/bot-workspace/knowledge/knowledgeRouteDataCache';
import { shouldPollKnowledgeSectionFromAgentTrainingStatus } from '@/lib/knowledgeSectionStatusPollGate';
import { isKnowledgePipelinePollingActive } from '@/lib/knowledgeTrainingStatus';
import {
  findCachedKnowledgeStatusItemForPoll,
  itemKnowledgePollNeedsItemScopedRefresh,
  knowledgeSectionsForWorkspaceBotRefresh,
  mergeKnowledgeStatusItemsPatchSectionRows,
  mergeKnowledgeStatusItemsReplacingManySections,
  mergeKnowledgeStatusItemsReplacingSection,
} from '@/lib/knowledgeStatusPollUtils';
import { redirectCustomerWorkspacePollGone } from '@/lib/customerResourceUnavailable';

/** Coordinator cadence for `GET …/knowledge/training/status` (includes `knowledgeUsage` for the storage bar). */
const POLL_MS = 5000;
/** After agent pipeline goes busy → idle, keep fetching typed `GET …/knowledge/status` this many ticks so rows catch up. */
const KB_SECTION_STATUS_TRAILING_TICKS = 3;

export type KbPollRegistration = {
  id: string;
  shouldPoll: () => boolean;
  poll: () => Promise<void>;
};

type KnowledgePollInterest = {
  section: KbTrainingAffectedType;
  itemId?: string;
};

export type KbWorkspacePollingContextValue = {
  botId: string;
  trainingStatus: CustomerAgentTrainingStatusResponse | null;
  trainingStatusError: string | null;
  /**
   * Synchronous peek at the latest training/status payload inside the coordinator tick (`await refreshTrainingStatus()`
   * updates this before React re-renders). UI that reads agent snapshot during the same tick can prefer this over
   * `trainingStatus` React state to avoid one-frame staleness.
   */
  trainingStatusPeekRef: RefObject<CustomerAgentTrainingStatusResponse | null>;
  refreshTrainingStatus: () => Promise<void>;
  /** Optimistic/immediate snapshot (e.g. POST retrain-agent response); clears error when non-null. */
  applyAgentTrainingSnapshot: (s: CustomerAgentTrainingStatusResponse | null) => void;
  registerKbPoll: (reg: KbPollRegistration) => () => void;
  /** Latest merged rows from typed `GET …/knowledge/status?type=…` polls. */
  knowledgeStatusItems: CustomerKnowledgeStatusItem[] | null;
  knowledgeStatusError: string | null;
  /** Fetch KB status (`itemId` = single-row poll for detail). */
  refreshKnowledgeStatus: (
    section?: KbTrainingAffectedType | 'all' | KbTrainingAffectedType[],
    itemId?: string,
  ) => Promise<void>;
  /**
   * Register section/list or item/detail interest. Coordinator polls when the section gate is true
   * ({@link shouldPollKnowledgeSectionFromAgentTrainingStatus}) or during trailing ticks after pipeline idle.
   */
  registerKnowledgeStatusPollInterest: (section: KbTrainingAffectedType, itemId?: string) => () => void;
  /**
   * Remaining coordinator ticks that still run section/item `GET …/knowledge/status` after pipeline idle
   * (busy → idle). Exposed so `registerKbPoll` `shouldPoll` can align with the coordinator.
   */
  kbSectionStatusTrailingTicksRemainingRef: RefObject<number>;
};

const KbWorkspacePollingContext = createContext<KbWorkspacePollingContextValue | null>(null);

export function KbWorkspacePollingProvider({ botId, children }: { botId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [trainingStatus, setTrainingStatus] = useState<CustomerAgentTrainingStatusResponse | null>(null);
  const [trainingStatusError, setTrainingStatusError] = useState<string | null>(null);
  const [knowledgeStatusItems, setKnowledgeStatusItems] = useState<CustomerKnowledgeStatusItem[] | null>(null);
  const [knowledgeStatusError, setKnowledgeStatusError] = useState<string | null>(null);
  const knowledgeStatusItemsRef = useRef<CustomerKnowledgeStatusItem[] | null>(null);

  const regsRef = useRef(new Map<string, KbPollRegistration>());
  const knowledgeInterestsRef = useRef(new Set<KnowledgePollInterest>());
  const inFlightRef = useRef(false);
  const cancelledRef = useRef(false);
  const kbSectionStatusTrailingTicksRemainingRef = useRef(0);

  /** Mirrors `trainingStatus` state synchronously during layout — aligns with {@link trainingStatusPeekRef}. */
  const trainingStatusPeekRef = useRef<CustomerAgentTrainingStatusResponse | null>(null);

  /** Latest agent training snapshot (for coordinator tick training/status cadence). */
  const trainingStatusRef = useRef<CustomerAgentTrainingStatusResponse | null>(null);
  trainingStatusRef.current = trainingStatus;

  const applyAgentTrainingSnapshot = useCallback((s: CustomerAgentTrainingStatusResponse | null) => {
    trainingStatusPeekRef.current = s;
    setTrainingStatus(s);
    if (s != null) {
      setTrainingStatusError(null);
    }
  }, []);

  useLayoutEffect(() => {
    trainingStatusPeekRef.current = trainingStatus;
  }, [trainingStatus]);

  useLayoutEffect(() => {
    knowledgeStatusItemsRef.current = knowledgeStatusItems;
  }, [knowledgeStatusItems]);

  const refreshTrainingStatus = useCallback(async () => {
    setTrainingStatusError(null);
    const res = await getCustomerBotAgentTrainingStatus(botId);
    if (!res.ok) {
      if (redirectCustomerWorkspacePollGone(navigate, res)) {
        setTrainingStatus(null);
        return;
      }
      setTrainingStatusError(res.error);
      setTrainingStatus(null);
      return;
    }
    const d = res.data;
    const normalized = Array.isArray(d.dataSources) ? d : { ...d, dataSources: [] };
    trainingStatusPeekRef.current = normalized;
    setTrainingStatus(normalized);
  }, [botId, navigate]);

  const refreshKnowledgeStatus = useCallback(
    async (section?: KbTrainingAffectedType | 'all' | KbTrainingAffectedType[], itemId?: string) => {
      const trimmedItemId = typeof itemId === 'string' ? itemId.trim() : '';
      const arraySection = Array.isArray(section) ? section : null;
      const types: KbTrainingAffectedType[] =
        trimmedItemId !== '' && section && section !== 'all' && !arraySection
          ? [section as KbTrainingAffectedType]
          : arraySection != null
            ? [...new Set(arraySection)]
            : section === 'all' || section == null
              ? [...KB_TRAINING_AFFECTED_ALL]
              : [section as KbTrainingAffectedType];
      if (types.length === 0) return;
      setKnowledgeStatusError(null);
      const results = await Promise.all(
        types.map((t) =>
          getCustomerBotKnowledgeStatus(botId, {
            type: t,
            ...(trimmedItemId !== '' ? { itemId: trimmedItemId } : {}),
          }),
        ),
      );
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        if (redirectCustomerWorkspacePollGone(navigate, failed)) {
          return;
        }
        setKnowledgeStatusError(failed.error);
        return;
      }
      setKnowledgeStatusItems((prev) => {
        if (trimmedItemId !== '' && section && section !== 'all' && !arraySection) {
          const items = results[0]?.ok ? results[0].data.items : [];
          return mergeKnowledgeStatusItemsPatchSectionRows(prev, section as KbTrainingAffectedType, items);
        }
        const updates = types.map((t, i) => ({
          section: t,
          items: results[i].ok ? results[i].data.items : [],
        }));
        return mergeKnowledgeStatusItemsReplacingManySections(prev, updates);
      });
    },
    [botId, navigate],
  );

  const registerKbPoll = useCallback((reg: KbPollRegistration) => {
    regsRef.current.set(reg.id, reg);
    return () => {
      regsRef.current.delete(reg.id);
    };
  }, []);

  const registerKnowledgeStatusPollInterest = useCallback((section: KbTrainingAffectedType, itemId?: string): (() => void) => {
    const entry: KnowledgePollInterest = { section, itemId };
    knowledgeInterestsRef.current.add(entry);
    return () => {
      knowledgeInterestsRef.current.delete(entry);
    };
  }, []);

  useEffect(() => {
    setTrainingStatus(null);
    trainingStatusPeekRef.current = null;
    setTrainingStatusError(null);
    setKnowledgeStatusItems(null);
    setKnowledgeStatusError(null);
    kbSectionStatusTrailingTicksRemainingRef.current = 0;
  }, [botId]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, [botId]);

  useEffect(() => {
    const onWorkspaceRefresh = (e: Event) => {
      const d = (e as CustomEvent<WorkspaceBotRefreshDetail>).detail;
      if (d?.botId !== botId) return;
      if (d.invalidateDocumentsListCache || d.refreshDocumentsList) {
        knowledgeDocumentsListCache.delete(botId);
      }
      void refreshTrainingStatus().then(() => {
        const registeredKeys = [
          ...new Set([...knowledgeInterestsRef.current].map((x) => x.section)),
        ] as KbTrainingAffectedType[];
        const sections = knowledgeSectionsForWorkspaceBotRefresh({
          affectedSections: d.affectedSections,
          registeredSectionKeys: registeredKeys,
          pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        });
        void refreshKnowledgeStatus(sections);
      });
    };
    window.addEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
    return () => window.removeEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
  }, [botId, refreshKnowledgeStatus, refreshTrainingStatus]);

  useEffect(() => {
    const tick = async () => {
      if (cancelledRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const snapshot = trainingStatusRef.current;
        const pipelineActiveBefore = isKnowledgePipelinePollingActive(snapshot);
        /** Always refetch training/status so `knowledgeUsage` stays current (documents/datasheets can change storage while pipeline looks idle). */
        await refreshTrainingStatus();

        const peek = trainingStatusPeekRef.current ?? trainingStatusRef.current;
        const pipelineActiveAfter = isKnowledgePipelinePollingActive(peek);
        if (pipelineActiveBefore && !pipelineActiveAfter) {
          kbSectionStatusTrailingTicksRemainingRef.current = Math.max(
            kbSectionStatusTrailingTicksRemainingRef.current,
            KB_SECTION_STATUS_TRAILING_TICKS,
          );
        }

        const tasks: Promise<unknown>[] = [];
        const trailingOpen = kbSectionStatusTrailingTicksRemainingRef.current > 0;

        type PendingReq = { section: KbTrainingAffectedType; itemId?: string };
        const dedup = new Map<string, PendingReq>();
        for (const entry of knowledgeInterestsRef.current) {
          try {
            const iid = entry.itemId?.trim() || '';
            const itemScopedPoll = iid !== '';
            const gate = shouldPollKnowledgeSectionFromAgentTrainingStatus(peek, entry.section);
            const cachedItem = findCachedKnowledgeStatusItemForPoll(
              knowledgeStatusItemsRef.current,
              entry.section,
              iid,
            );
            const needInitialScopedRow = itemScopedPoll && cachedItem == null;
            const itemScopedWantsPoll =
              itemScopedPoll &&
              cachedItem != null &&
              itemKnowledgePollNeedsItemScopedRefresh(cachedItem, entry.section);
            if (!gate && !trailingOpen && !itemScopedPoll) continue;
            if (itemScopedPoll && !gate && !trailingOpen && !needInitialScopedRow && !itemScopedWantsPoll) {
              continue;
            }
            const key = `${entry.section}:${iid}`;
            if (!dedup.has(key)) dedup.set(key, { section: entry.section, itemId: iid || undefined });
          } catch {
            /* gate */
          }
        }

        if (dedup.size > 0) {
          tasks.push(
            (async () => {
              setKnowledgeStatusError(null);
              for (const req of dedup.values()) {
                const res = await getCustomerBotKnowledgeStatus(botId, {
                  type: req.section,
                  ...(req.itemId ? { itemId: req.itemId } : {}),
                });
                if (!res.ok) {
                  if (redirectCustomerWorkspacePollGone(navigate, res)) {
                    return;
                  }
                  setKnowledgeStatusError(res.error);
                  continue;
                }
                const items = res.data.items ?? [];
                setKnowledgeStatusItems((prev) =>
                  req.itemId
                    ? mergeKnowledgeStatusItemsPatchSectionRows(prev, req.section, items)
                    : mergeKnowledgeStatusItemsReplacingSection(prev, req.section, items),
                );
              }
            })(),
          );
        }

        for (const r of regsRef.current.values()) {
          try {
            if (r.shouldPoll()) tasks.push(r.poll());
          } catch {
            /* shouldPoll */
          }
        }
        await Promise.all(tasks);

        if (kbSectionStatusTrailingTicksRemainingRef.current > 0) {
          kbSectionStatusTrailingTicksRemainingRef.current -= 1;
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(id);
  }, [botId, refreshTrainingStatus, refreshKnowledgeStatus, navigate]);

  const value = useMemo<KbWorkspacePollingContextValue>(
    () => ({
      botId,
      trainingStatus,
      trainingStatusPeekRef,
      trainingStatusError,
      refreshTrainingStatus,
      applyAgentTrainingSnapshot,
      registerKbPoll,
      knowledgeStatusItems,
      knowledgeStatusError,
      refreshKnowledgeStatus,
      registerKnowledgeStatusPollInterest,
      kbSectionStatusTrailingTicksRemainingRef,
    }),
    [
      botId,
      trainingStatus,
      trainingStatusPeekRef,
      trainingStatusError,
      refreshTrainingStatus,
      applyAgentTrainingSnapshot,
      registerKbPoll,
      knowledgeStatusItems,
      knowledgeStatusError,
      refreshKnowledgeStatus,
      registerKnowledgeStatusPollInterest,
      kbSectionStatusTrailingTicksRemainingRef,
    ],
  );

  return <KbWorkspacePollingContext.Provider value={value}>{children}</KbWorkspacePollingContext.Provider>;
}

export function useKbWorkspacePolling(): KbWorkspacePollingContextValue {
  const ctx = useContext(KbWorkspacePollingContext);
  if (!ctx) throw new Error('useKbWorkspacePolling must be used under KbWorkspacePollingProvider');
  return ctx;
}

export function useKbPollRegistration(
  active: boolean,
  registration: { id: string; shouldPoll: () => boolean; poll: () => Promise<void> },
) {
  const { registerKbPoll } = useKbWorkspacePolling();
  const shouldRef = useRef(registration.shouldPoll);
  const pollRef = useRef(registration.poll);
  shouldRef.current = registration.shouldPoll;
  pollRef.current = registration.poll;

  useEffect(() => {
    if (!active) return;
    return registerKbPoll({
      id: registration.id,
      shouldPoll: () => shouldRef.current(),
      poll: () => pollRef.current(),
    });
  }, [active, registration.id, registerKbPoll]);
}

/**
 * Register KB status poll interest (list or detail row). Coordinator uses {@link shouldPollKnowledgeSectionFromAgentTrainingStatus}
 * plus trailing ticks after pipeline idle.
 */
export function useKbKnowledgeStatusPollInterest(
  active: boolean,
  section: KbTrainingAffectedType,
  itemId?: string,
): void {
  const { registerKnowledgeStatusPollInterest } = useKbWorkspacePolling();

  useEffect(() => {
    if (!active) return;
    return registerKnowledgeStatusPollInterest(section, itemId);
  }, [active, section, itemId, registerKnowledgeStatusPollInterest]);
}
