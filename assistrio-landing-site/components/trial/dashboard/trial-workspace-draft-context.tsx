"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { fetchTrialWorkspaceDraft, patchTrialWorkspaceDraft } from "@/lib/trial/trial-draft-api";
import {
  apiDraftJsonToTrialWorkspaceDraftV3,
  buildFullMigrationPatchFromDraft,
  buildPatchForContinueKnowledgeToGoLive,
  buildPatchPayloadForStepCompletion,
  hasMeaningfulLocalProgress,
  isServerDraftDefaultForMigration,
  TRIAL_DRAFT_LS_MIGRATION_DONE_KEY,
} from "@/lib/trial/trial-draft-sync";
import {
  createEmptyWorkspaceDraft,
  finalizeTrialProfile,
  readWorkspaceDraftFromLocalStorage,
  writeWorkspaceDraftToLocalStorage,
  type TrialWorkspaceBehavior,
  type TrialWorkspaceDraftV3,
  type TrialWorkspaceKnowledgePlaceholder,
  type TrialWorkspaceProfile,
} from "@/lib/trial/trial-workspace-draft";
import { useTrialDashboardToast } from "@/components/trial/dashboard/trial-dashboard-toast";

type PersistResult = { ok: true } | { ok: false; errorMessage: string };

type TrialWorkspaceDraftContextValue = {
  draft: TrialWorkspaceDraftV3;
  /** True after server hydration (or error recovery) — same as before for gating navigation. */
  hydrated: boolean;
  hydrationError: string | null;
  retryHydration: () => void;
  saveStatus: "idle" | "saved";
  setProfile: (patch: Partial<TrialWorkspaceProfile>) => void;
  setBehavior: (patch: Partial<TrialWorkspaceBehavior>) => void;
  setAllowedWebsite: (value: string) => void;
  setAllowedDomainsExtra: (value: string) => void;
  setKnowledge: (patch: Partial<TrialWorkspaceKnowledgePlaceholder>) => void;
  setKnowledgeContinued: (value: boolean) => void;
  bumpSetupExplicitMaxAfterCompletingStep: (completedStepIndex: number) => void;
  continueKnowledgeToGoLive: () => void;
  /** Full replace or functional update (e.g. merge upload responses into current draft). */
  replaceDraft: Dispatch<SetStateAction<TrialWorkspaceDraftV3>>;
  /** Persist current step to server, then caller navigates. Server response becomes source of truth. */
  persistStepOnNext: (completedStepIndex: number, opts?: { finalizeToCreating?: boolean }) => Promise<PersistResult>;
  persistContinueKnowledgeToGoLive: () => Promise<PersistResult>;
};

const TrialWorkspaceDraftContext = createContext<TrialWorkspaceDraftContextValue | null>(null);

export function TrialWorkspaceDraftProvider({ children }: { children: ReactNode }) {
  const { showToast } = useTrialDashboardToast();
  const [draft, setDraft] = useState<TrialWorkspaceDraftV3>(() => createEmptyWorkspaceDraft());
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const [hydrationReady, setHydrationReady] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  const runHydration = useCallback(async () => {
    setHydrationError(null);
    setHydrationReady(false);
    try {
      const res = await fetchTrialWorkspaceDraft();
      if (!res.ok) {
        setHydrationError(res.errorMessage);
        return;
      }

      const serverDraft = apiDraftJsonToTrialWorkspaceDraftV3(res.draft);
      const migrationDone =
        typeof window !== "undefined" && window.localStorage.getItem(TRIAL_DRAFT_LS_MIGRATION_DONE_KEY) === "1";

      if (migrationDone) {
        setDraft(serverDraft);
        writeWorkspaceDraftToLocalStorage(serverDraft);
        setHydrationReady(true);
        return;
      }

      if (hasMeaningfulLocalProgress(serverDraft)) {
        setDraft(serverDraft);
        writeWorkspaceDraftToLocalStorage(serverDraft);
        setHydrationReady(true);
        return;
      }

      const localDraft = readWorkspaceDraftFromLocalStorage();
      if (hasMeaningfulLocalProgress(localDraft) && isServerDraftDefaultForMigration(serverDraft)) {
        const patchRes = await patchTrialWorkspaceDraft(buildFullMigrationPatchFromDraft(localDraft));
        if (patchRes.ok) {
          const merged = apiDraftJsonToTrialWorkspaceDraftV3(patchRes.draft);
          setDraft(merged);
          writeWorkspaceDraftToLocalStorage(merged);
          try {
            window.localStorage.setItem(TRIAL_DRAFT_LS_MIGRATION_DONE_KEY, "1");
          } catch {
            /* quota */
          }
        } else {
          showToast({ message: patchRes.errorMessage, variant: "error" });
          setDraft(localDraft);
          writeWorkspaceDraftToLocalStorage(localDraft);
        }
        setHydrationReady(true);
        return;
      }

      setDraft(serverDraft);
      writeWorkspaceDraftToLocalStorage(serverDraft);
      setHydrationReady(true);
    } catch {
      setHydrationError("Could not load your workspace. Check your connection and try again.");
    }
  }, [showToast]);

  useEffect(() => {
    void runHydration();
  }, [runHydration]);

  const retryHydration = useCallback(() => {
    void runHydration();
  }, [runHydration]);

  useEffect(() => {
    if (!hydrationReady || typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      writeWorkspaceDraftToLocalStorage(draftRef.current);
      setSaveStatus("saved");
    }, 450);
    return () => window.clearTimeout(id);
  }, [draft, hydrationReady]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = window.setTimeout(() => setSaveStatus("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  const setProfile = useCallback((patch: Partial<TrialWorkspaceProfile>) => {
    setDraft((d) => ({
      ...d,
      profile: finalizeTrialProfile({ ...d.profile, ...patch }),
    }));
  }, []);

  const setBehavior = useCallback((patch: Partial<TrialWorkspaceBehavior>) => {
    setDraft((d) => ({
      ...d,
      behavior: { ...d.behavior, ...patch },
    }));
  }, []);

  const setAllowedWebsite = useCallback((value: string) => {
    setDraft((d) => ({ ...d, allowedWebsite: value }));
  }, []);

  const setAllowedDomainsExtra = useCallback((value: string) => {
    setDraft((d) => ({ ...d, allowedDomainsExtra: value }));
  }, []);

  const setKnowledge = useCallback((patch: Partial<TrialWorkspaceKnowledgePlaceholder>) => {
    setDraft((d) => ({
      ...d,
      knowledge: { ...d.knowledge, ...patch },
    }));
  }, []);

  const setKnowledgeContinued = useCallback((value: boolean) => {
    setDraft((d) => ({ ...d, knowledgeContinued: value }));
  }, []);

  const replaceDraft = useCallback<Dispatch<SetStateAction<TrialWorkspaceDraftV3>>>((next) => {
    setDraft(next);
  }, []);

  const bumpSetupExplicitMaxAfterCompletingStep = useCallback((completedStepIndex: number) => {
    setDraft((d) => {
      const prev = d.setupExplicitMaxStepIndex ?? 0;
      const next = Math.min(3, Math.max(prev, completedStepIndex + 1));
      const once = [...d.setupStepOnceCompleted] as [boolean, boolean, boolean, boolean];
      if (completedStepIndex >= 0 && completedStepIndex <= 3) once[completedStepIndex] = true;
      return {
        ...d,
        setupExplicitMaxStepIndex: next,
        setupStepOnceCompleted: once,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const continueKnowledgeToGoLive = useCallback(() => {
    setDraft((d) => {
      const once = [...d.setupStepOnceCompleted] as [boolean, boolean, boolean, boolean];
      once[2] = true;
      return {
        ...d,
        knowledgeContinued: true,
        setupExplicitMaxStepIndex: Math.min(3, Math.max(d.setupExplicitMaxStepIndex ?? 0, 3)),
        setupStepOnceCompleted: once,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const persistStepOnNext = useCallback(
    async (completedStepIndex: number, opts?: { finalizeToCreating?: boolean }): Promise<PersistResult> => {
      const d = draftRef.current;
      const patch = buildPatchPayloadForStepCompletion(d, completedStepIndex, opts);
      const res = await patchTrialWorkspaceDraft(patch);
      if (!res.ok) {
        showToast({ message: res.errorMessage, variant: "error" });
        return { ok: false, errorMessage: res.errorMessage };
      }
      const next = apiDraftJsonToTrialWorkspaceDraftV3(res.draft);
      setDraft(next);
      writeWorkspaceDraftToLocalStorage(next);
      return { ok: true };
    },
    [showToast],
  );

  const persistContinueKnowledgeToGoLive = useCallback(async (): Promise<PersistResult> => {
    const d = draftRef.current;
    const patch = buildPatchForContinueKnowledgeToGoLive(d);
    const res = await patchTrialWorkspaceDraft(patch);
    if (!res.ok) {
      showToast({ message: res.errorMessage, variant: "error" });
      return { ok: false, errorMessage: res.errorMessage };
    }
    const next = apiDraftJsonToTrialWorkspaceDraftV3(res.draft);
    setDraft(next);
    writeWorkspaceDraftToLocalStorage(next);
    return { ok: true };
  }, [showToast]);

  const value = useMemo(
    () => ({
      draft,
      hydrated: hydrationReady,
      hydrationError,
      retryHydration,
      saveStatus,
      setProfile,
      setBehavior,
      setAllowedWebsite,
      setAllowedDomainsExtra,
      setKnowledge,
      setKnowledgeContinued,
      bumpSetupExplicitMaxAfterCompletingStep,
      continueKnowledgeToGoLive,
      replaceDraft,
      persistStepOnNext,
      persistContinueKnowledgeToGoLive,
    }),
    [
      draft,
      hydrationReady,
      hydrationError,
      retryHydration,
      saveStatus,
      setProfile,
      setBehavior,
      setAllowedWebsite,
      setAllowedDomainsExtra,
      setKnowledge,
      setKnowledgeContinued,
      bumpSetupExplicitMaxAfterCompletingStep,
      continueKnowledgeToGoLive,
      replaceDraft,
      persistStepOnNext,
      persistContinueKnowledgeToGoLive,
    ],
  );

  return (
    <TrialWorkspaceDraftContext.Provider value={value}>
      {hydrationError ? (
        <div className="border-b border-amber-200/90 bg-amber-50/95 px-4 py-3 text-center text-sm text-amber-950">
          <p className="font-medium">{hydrationError}</p>
          <button
            type="button"
            className="mt-2 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200/90"
            onClick={() => retryHydration()}
          >
            Retry
          </button>
        </div>
      ) : null}
      {children}
    </TrialWorkspaceDraftContext.Provider>
  );
}

export function useTrialWorkspaceDraft(): TrialWorkspaceDraftContextValue {
  const ctx = useContext(TrialWorkspaceDraftContext);
  if (!ctx) {
    throw new Error("useTrialWorkspaceDraft must be used within TrialWorkspaceDraftProvider");
  }
  return ctx;
}
