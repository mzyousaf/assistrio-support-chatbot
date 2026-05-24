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
import { useNavigate } from 'react-router-dom';
import {
  getCustomerBot,
  getCustomerWorkspaceOnboarding,
  patchCustomerWorkspaceOnboardingGoLive,
  patchCustomerWorkspaceOnboardingInstructions,
  patchCustomerWorkspaceOnboardingKnowledge,
  patchCustomerWorkspaceOnboardingProfile,
  patchCustomerWorkspaceOnboardingProgress,
  postCustomerWorkspaceOnboardingGoLive,
  postCustomerWorkspaceOnboardingComplete,
  postCustomerWorkspaceOnboardingAvatar,
  postCustomerWorkspaceOnboardingDocuments,
  postCustomerWorkspaceOnboardingDatasheet,
  deleteCustomerWorkspaceOnboardingDocument,
  deleteCustomerWorkspaceOnboardingDatasheet,
  postCustomerWorkspaceOnboardingDocumentsBulkDelete,
  postCustomerWorkspaceOnboardingDatasheetsBulkDelete,
  postCustomerWorkspaceOnboardingSnippet,
  patchCustomerWorkspaceOnboardingSnippet,
  deleteCustomerWorkspaceOnboardingSnippet,
  postCustomerWorkspaceOnboardingSnippetsBulkDelete,
  postCustomerWorkspaceOnboardingQa,
  patchCustomerWorkspaceOnboardingQa,
  deleteCustomerWorkspaceOnboardingQa,
  postCustomerWorkspaceOnboardingQasBulkDelete,
  postCustomerWorkspaceOnboardingQaImport,
  postCustomerWorkspaceOnboardingSnippetImport,
  postCustomerWorkspaceOnboardingDictation,
} from '../api/customerApi';
import type {
  CustomerBotLifecycleResponse,
  WorkspaceOnboardingGoLiveBot,
  WorkspaceOnboardingResponse,
} from '../api/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { persistPostGoLiveInstallBotId } from '@/components/onboarding/PostGoLiveInstallModalHost';
import {
  postOnboardingGoLiveBotDestination,
  postOnboardingGoLiveBotsListFallback,
} from '@/routes/postGoLiveNavigation';
import { isLikelyNetworkFailureMessage } from '@/lib/workspaceLoadFailurePresentation';
import { buildOnboardingChatWidgetSnippetFromInstallBot } from './onboardingInstallSnippets';
import { mergeStepsCompletedFromDraft } from './onboardingProgress';
import { nextStepPath } from './onboardingState';

export function normalizeOriginForSave(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' || h === '::1') {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

type FlowPhase = 'loading' | 'ready' | 'error';

type PatchResult =
  | { ok: true; knowledgeProcessingWarning?: string }
  | { ok: false; error: string; recoverable?: boolean };

type BulkDeleteResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

function apiErrorMessage(res: {
  ok: false;
  error: string;
  data?: unknown;
  body?: unknown;
}): string {
  if (!res.ok) {
    const data = (res.data ?? res.body) as {
      error?: string;
      message?: string;
      errorCode?: string;
      details?: Array<{ row?: number; column?: string; message?: string }>;
    } | undefined;
    if (Array.isArray(data?.details) && data.details.length > 0) {
      const lines = data.details
        .slice(0, 8)
        .map((d) => `Row ${d.row ?? '?'} (${d.column ?? 'field'}): ${d.message ?? 'Invalid'}`);
      const combined = [data?.error ?? data?.message ?? res.error, ...lines].join('\n');
      return isLikelyNetworkFailureMessage(combined) ? '' : combined;
    }
    const msg = data?.error ?? data?.message ?? res.error;
    return isLikelyNetworkFailureMessage(msg) ? '' : msg;
  }
  return 'Request failed';
}

function extractImportErrorDetails(res: {
  ok: false;
  data?: unknown;
  body?: unknown;
}): Array<{ row: number; column: string; message: string }> | undefined {
  const data = (res.data ?? res.body) as {
    details?: Array<{ row?: number; column?: string; message?: string }>;
  } | undefined;
  if (!Array.isArray(data?.details) || data.details.length === 0) return undefined;
  return data.details.map((d) => ({
    row: d.row ?? 0,
    column: d.column ?? 'field',
    message: d.message ?? 'Invalid',
  }));
}

function parseRecoverableGoLiveFailure(res: {
  ok: false;
  error: string;
  body?: unknown;
  data?: unknown;
}):
  | { recoverable: true; message: string; bot: WorkspaceOnboardingGoLiveBot }
  | null {
  const data = (res.data ?? res.body) as {
    recoverable?: boolean;
    error?: string;
    message?: string;
    bot?: WorkspaceOnboardingGoLiveBot;
  } | null;
  if (data?.recoverable && data.bot?.id) {
    return {
      recoverable: true,
      message: data.error ?? data.message ?? 'Your agent was created, but some knowledge is still being prepared. Try again.',
      bot: data.bot,
    };
  }
  return null;
}

function mapGoLiveBotToLifecycleResult(
  bot: WorkspaceOnboardingGoLiveBot,
  botId: string,
): Extract<CustomerBotLifecycleResponse, { action: 'publish' }> {
  return {
    ok: true,
    action: 'publish',
    status: 'published',
    embedSnippet: buildOnboardingChatWidgetSnippetFromInstallBot(bot, botId),
    accessKey: String(bot.accessKey ?? ''),
    allowedOrigins: (bot.allowedOrigins ?? [])
      .filter((o) => o.isActive !== false && String(o.origin ?? '').trim())
      .map((o) => String(o.origin).trim()),
  };
}

export type OnboardingGoLivePublishResult =
  | {
      ok: true;
      botId: string;
      lifecycle: Extract<CustomerBotLifecycleResponse, { action: 'publish' }>;
      knowledgeProcessingWarning?: string;
    }
  | { ok: false; error: string; recoverable?: boolean };

function resolvePrimaryWorkspaceId(
  workspaces: Array<{ id: string }> | undefined,
): string | null {
  const id = workspaces?.[0]?.id;
  return id?.trim() || null;
}

type OnboardingFlowValue = {
  phase: FlowPhase;
  initError: string | null;
  workspaceId: string | null;
  onboarding: WorkspaceOnboardingResponse | null;
  /** Published bot returned from POST go-live (or loaded on resume). */
  liveBot: WorkspaceOnboardingGoLiveBot | null;
  stepsCompleted: string[];
  reloadOnboarding: () => Promise<void>;
  patchProfile: (body: Record<string, unknown>) => Promise<PatchResult>;
  patchInstructions: (body: Record<string, unknown>) => Promise<PatchResult>;
  patchKnowledge: (body: Record<string, unknown>) => Promise<PatchResult>;
  patchGoLiveOrigins: (body: Record<string, unknown>) => Promise<PatchResult>;
  markStepDone: (path: string) => Promise<void>;
  goToNextAfter: (currentPath: string) => void;
  publishForGoLive: (opts: {
    origin: string;
    label: string;
    /** Skip POST go-live and only mark onboarding complete (agent already live). */
    completeOnly?: boolean;
  }) => Promise<PatchResult>;
  /** POST onboarding go-live only — no step completion or dashboard redirect. */
  runOnboardingGoLive: (opts: { origin: string; label: string }) => Promise<OnboardingGoLivePublishResult>;
  uploadAvatar: (file: File) => Promise<
    | { ok: true; profile: import('../api/types').WorkspaceOnboardingDraftProfile }
    | { ok: false; error: string }
  >;
  uploadOnboardingDocuments: (files: File[]) => Promise<PatchResult>;
  uploadOnboardingDatasheet: (file: File) => Promise<PatchResult>;
  deleteOnboardingDocument: (id: string) => Promise<PatchResult>;
  deleteOnboardingDocuments: (ids: string[]) => Promise<BulkDeleteResult>;
  deleteOnboardingDatasheet: (id: string) => Promise<PatchResult>;
  deleteOnboardingDatasheets: (ids: string[]) => Promise<BulkDeleteResult>;
  createOnboardingSnippet: (body: { title: string; description: string }) => Promise<PatchResult>;
  updateOnboardingSnippet: (id: string, body: { title: string; description: string }) => Promise<PatchResult>;
  deleteOnboardingSnippet: (id: string) => Promise<PatchResult>;
  deleteOnboardingSnippets: (ids: string[]) => Promise<BulkDeleteResult>;
  createOnboardingQa: (body: { title: string; questions: string[]; answer: string }) => Promise<PatchResult>;
  updateOnboardingQa: (id: string, body: { title: string; questions: string[]; answer: string }) => Promise<PatchResult>;
  deleteOnboardingQa: (id: string) => Promise<PatchResult>;
  deleteOnboardingQas: (ids: string[]) => Promise<BulkDeleteResult>;
  importOnboardingQas: (file: File) => Promise<
    PatchResult & {
      imported?: number;
      skippedCount?: number;
      skippedReason?: string;
      details?: Array<{ row: number; column: string; message: string }>;
    }
  >;
  importOnboardingSnippets: (file: File) => Promise<
    PatchResult & {
      imported?: number;
      skippedCount?: number;
      skippedReason?: string;
      details?: Array<{ row: number; column: string; message: string }>;
    }
  >;
  transcribeDescribeAgent: (file: File) => Promise<PatchResult & { text?: string }>;
  finishOnboarding: (opts?: {
    liveBotId?: string;
    showInstall?: boolean;
    beforeNavigate?: () => void;
  }) => Promise<void>;
};

const OnboardingFlowContext = createContext<OnboardingFlowValue | null>(null);

export function OnboardingFlowProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { customer, refresh, patchPrimaryWorkspaceOnboardingStatus } = useCustomerAuth();
  const [phase, setPhase] = useState<FlowPhase>('loading');
  const [initError, setInitError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<WorkspaceOnboardingResponse | null>(null);
  const [liveBot, setLiveBot] = useState<WorkspaceOnboardingGoLiveBot | null>(null);
  const [stepsCompleted, setStepsCompleted] = useState<string[]>([]);
  const publishingRef = useRef(false);
  const customerRef = useRef(customer);
  customerRef.current = customer;

  const applyOnboardingState = useCallback((data: WorkspaceOnboardingResponse) => {
    setOnboarding((prev) => ({
      ...data,
      stagedKnowledge: data.stagedKnowledge ??
        prev?.stagedKnowledge ?? { documents: [], datasheets: [] },
    }));
    setStepsCompleted(mergeStepsCompletedFromDraft(data));
  }, []);

  const loadLiveBotIfNeeded = useCallback(
    async (data: WorkspaceOnboardingResponse): Promise<WorkspaceOnboardingGoLiveBot | null> => {
      if (!data.onboardingCreatedBotId) return null;
      const res = await getCustomerBot(data.onboardingCreatedBotId);
      if (!res.ok) return null;
      const b = res.data.bot;
      return {
        id: data.onboardingCreatedBotId,
        name: String(b.name ?? ''),
        slug: String(b.slug ?? ''),
        status: 'published',
        accessKey: String(b.accessKey ?? ''),
        ...(b.visibility === 'private' && b.secretKey ? { secretKey: String(b.secretKey) } : {}),
        visibility: b.visibility === 'private' ? 'private' : 'public',
        allowedOrigins: Array.isArray(b.allowedOrigins) ? b.allowedOrigins : [],
      };
    },
    [],
  );

  const bootstrap = useCallback(async () => {
    setPhase('loading');
    setInitError(null);

    const wsId = resolvePrimaryWorkspaceId(customerRef.current?.workspaces);
    if (!wsId) {
      setInitError('No workspace found for your account.');
      setPhase('error');
      return;
    }

    setWorkspaceId(wsId);
    const res = await getCustomerWorkspaceOnboarding(wsId);
    if (!res.ok) {
      setInitError(apiErrorMessage(res));
      setPhase('error');
      return;
    }

    applyOnboardingState(res.data);

    if (res.data.onboardingCreatedBotId) {
      const bot = await loadLiveBotIfNeeded(res.data);
      if (bot) setLiveBot(bot);
    }

    setPhase('ready');
  }, [applyOnboardingState, loadLiveBotIfNeeded]);

  useEffect(() => {
    if (customer == null) return;
    let cancelled = false;
    void (async () => {
      await bootstrap();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, customer?.id]);

  const reloadOnboarding = useCallback(async () => {
    if (!workspaceId) return;
    const res = await getCustomerWorkspaceOnboarding(workspaceId);
    if (res.ok) {
      applyOnboardingState(res.data);
    }
  }, [applyOnboardingState, workspaceId]);

  const markStepDone = useCallback(
    async (path: string) => {
      if (!workspaceId) return;
      const next = nextStepPath(path);
      const res = await patchCustomerWorkspaceOnboardingProgress(workspaceId, {
        completedStep: path,
        ...(next ? { currentStep: next } : {}),
      });
      if (res.ok) {
        applyOnboardingState(res.data);
      } else {
        setStepsCompleted((prev) => (prev.includes(path) ? prev : [...prev, path]));
      }
    },
    [applyOnboardingState, workspaceId],
  );

  const patchProfile = useCallback(
    async (body: Record<string, unknown>) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await patchCustomerWorkspaceOnboardingProfile(workspaceId, body);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const };
    },
    [applyOnboardingState, workspaceId],
  );

  const patchInstructions = useCallback(
    async (body: Record<string, unknown>) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await patchCustomerWorkspaceOnboardingInstructions(workspaceId, body);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const };
    },
    [applyOnboardingState, workspaceId],
  );

  const patchKnowledge = useCallback(
    async (body: Record<string, unknown>) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await patchCustomerWorkspaceOnboardingKnowledge(workspaceId, body);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const };
    },
    [applyOnboardingState, workspaceId],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const fd = new FormData();
      fd.append('file', file);
      const res = await postCustomerWorkspaceOnboardingAvatar(workspaceId, fd);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const, profile: res.data.draft.profile };
    },
    [applyOnboardingState, workspaceId],
  );

  const uploadOnboardingDocuments = useCallback(
    async (files: File[]) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await postCustomerWorkspaceOnboardingDocuments(workspaceId, files);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const };
    },
    [applyOnboardingState, workspaceId],
  );

  const uploadOnboardingDatasheet = useCallback(
    async (file: File) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await postCustomerWorkspaceOnboardingDatasheet(workspaceId, file);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const };
    },
    [applyOnboardingState, workspaceId],
  );

  const applyOnboardingResponse = useCallback(
    (res: { ok: true; data: WorkspaceOnboardingResponse } | { ok: false; error: string; data?: unknown }) => {
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const };
    },
    [applyOnboardingState],
  );

  const applyOnboardingBulkDeleteResponse = useCallback(
    (
      res:
        | { ok: true; data: WorkspaceOnboardingResponse & { deletedCount?: number } }
        | { ok: false; error: string; data?: unknown },
    ): BulkDeleteResult => {
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const, deletedCount: res.data.deletedCount ?? 0 };
    },
    [applyOnboardingState],
  );

  const deleteOnboardingDocument = useCallback(
    async (id: string) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await deleteCustomerWorkspaceOnboardingDocument(workspaceId, id));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const deleteOnboardingDocuments = useCallback(
    async (ids: string[]) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingBulkDeleteResponse(
        await postCustomerWorkspaceOnboardingDocumentsBulkDelete(workspaceId, ids),
      );
    },
    [applyOnboardingBulkDeleteResponse, workspaceId],
  );

  const deleteOnboardingDatasheet = useCallback(
    async (id: string) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await deleteCustomerWorkspaceOnboardingDatasheet(workspaceId, id));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const deleteOnboardingDatasheets = useCallback(
    async (ids: string[]) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingBulkDeleteResponse(
        await postCustomerWorkspaceOnboardingDatasheetsBulkDelete(workspaceId, ids),
      );
    },
    [applyOnboardingBulkDeleteResponse, workspaceId],
  );

  const createOnboardingSnippet = useCallback(
    async (body: { title: string; description: string }) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await postCustomerWorkspaceOnboardingSnippet(workspaceId, body));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const updateOnboardingSnippet = useCallback(
    async (id: string, body: { title: string; description: string }) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await patchCustomerWorkspaceOnboardingSnippet(workspaceId, id, body));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const deleteOnboardingSnippet = useCallback(
    async (id: string) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await deleteCustomerWorkspaceOnboardingSnippet(workspaceId, id));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const deleteOnboardingSnippets = useCallback(
    async (ids: string[]) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingBulkDeleteResponse(
        await postCustomerWorkspaceOnboardingSnippetsBulkDelete(workspaceId, ids),
      );
    },
    [applyOnboardingBulkDeleteResponse, workspaceId],
  );

  const createOnboardingQa = useCallback(
    async (body: { title: string; questions: string[]; answer: string }) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await postCustomerWorkspaceOnboardingQa(workspaceId, body));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const updateOnboardingQa = useCallback(
    async (id: string, body: { title: string; questions: string[]; answer: string }) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await patchCustomerWorkspaceOnboardingQa(workspaceId, id, body));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const deleteOnboardingQa = useCallback(
    async (id: string) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingResponse(await deleteCustomerWorkspaceOnboardingQa(workspaceId, id));
    },
    [applyOnboardingResponse, workspaceId],
  );

  const deleteOnboardingQas = useCallback(
    async (ids: string[]) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      return applyOnboardingBulkDeleteResponse(
        await postCustomerWorkspaceOnboardingQasBulkDelete(workspaceId, ids),
      );
    },
    [applyOnboardingBulkDeleteResponse, workspaceId],
  );

  const importOnboardingQas = useCallback(
    async (file: File) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await postCustomerWorkspaceOnboardingQaImport(workspaceId, file);
      if (!res.ok) {
        return {
          ok: false as const,
          error: apiErrorMessage(res),
          details: extractImportErrorDetails(res),
        };
      }
      applyOnboardingState(res.data);
      return {
        ok: true as const,
        imported: res.data.imported,
        skippedCount: res.data.skippedCount,
        skippedReason: res.data.skippedReason,
      };
    },
    [applyOnboardingState, workspaceId],
  );

  const importOnboardingSnippets = useCallback(
    async (file: File) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await postCustomerWorkspaceOnboardingSnippetImport(workspaceId, file);
      if (!res.ok) {
        return {
          ok: false as const,
          error: apiErrorMessage(res),
          details: extractImportErrorDetails(res),
        };
      }
      applyOnboardingState(res.data);
      return {
        ok: true as const,
        imported: res.data.imported,
        skippedCount: res.data.skippedCount,
        skippedReason: res.data.skippedReason,
      };
    },
    [applyOnboardingState, workspaceId],
  );

  const transcribeDescribeAgent = useCallback(
    async (file: File) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await postCustomerWorkspaceOnboardingDictation(workspaceId, file);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      return { ok: true as const, text: res.data.text };
    },
    [workspaceId],
  );

  const patchGoLiveOrigins = useCallback(
    async (body: Record<string, unknown>) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace' };
      const res = await patchCustomerWorkspaceOnboardingGoLive(workspaceId, body);
      if (!res.ok) return { ok: false as const, error: apiErrorMessage(res) };
      applyOnboardingState(res.data);
      return { ok: true as const };
    },
    [applyOnboardingState, workspaceId],
  );

  const goToNextAfter = useCallback(
    (currentPath: string) => {
      const n = nextStepPath(currentPath);
      if (n) navigate(`/onboarding/${n}`);
      else navigate('/bots');
    },
    [navigate],
  );

  const finishOnboarding = useCallback(
    async (opts?: { liveBotId?: string; showInstall?: boolean; beforeNavigate?: () => void }) => {
      const botId = opts?.liveBotId?.trim();
      const openInstall = opts?.showInstall === true && Boolean(botId);

      async function resolveDashboardPath(): Promise<string> {
        if (!openInstall || !botId) return '/bots';
        try {
          const res = await getCustomerBot(botId);
          if (res.ok) {
            return postOnboardingGoLiveBotDestination(botId, { showInstall: true });
          }
        } catch {
          /* fall through to list fallback */
        }
        return postOnboardingGoLiveBotsListFallback(botId);
      }

      const dashboardPath = await resolveDashboardPath();

      if (!workspaceId) {
        if (openInstall && botId) persistPostGoLiveInstallBotId(botId);
        opts?.beforeNavigate?.();
        navigate(dashboardPath, { replace: true });
        return;
      }

      if (onboarding?.onboardingStatus !== 'completed') {
        const res = await postCustomerWorkspaceOnboardingComplete(workspaceId);
        if (!res.ok) {
          throw new Error(res.error);
        }
        applyOnboardingState(res.data);
      }

      if (openInstall && botId) persistPostGoLiveInstallBotId(botId);
      patchPrimaryWorkspaceOnboardingStatus('completed');
      opts?.beforeNavigate?.();
      navigate(dashboardPath, { replace: true });
      void refresh();
    },
    [
      applyOnboardingState,
      navigate,
      onboarding?.onboardingStatus,
      patchPrimaryWorkspaceOnboardingStatus,
      refresh,
      workspaceId,
    ],
  );

  const finishOnboardingAndOpenDashboard = useCallback(
    async (botId: string) => {
      try {
        await finishOnboarding({ liveBotId: botId, showInstall: true });
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : 'Failed to complete onboarding' };
      }
    },
    [finishOnboarding],
  );

  const runOnboardingGoLive = useCallback(
    async (opts: { origin: string; label: string }): Promise<OnboardingGoLivePublishResult> => {
      if (publishingRef.current) {
        return { ok: false, error: 'Publish already in progress.' };
      }
      if (!workspaceId) {
        return { ok: false, error: 'Onboarding is not ready.' };
      }

      const originNorm = normalizeOriginForSave(opts.origin);
      if (!originNorm) {
        return {
          ok: false,
          error:
            'Enter a valid website URL (https://…). Localhost cannot be saved as an allowed embed origin.',
        };
      }

      publishingRef.current = true;
      try {
        const res = await postCustomerWorkspaceOnboardingGoLive(workspaceId, {
          origin: originNorm,
          ...(opts.label.trim() ? { label: opts.label.trim() } : {}),
        });
        if (!res.ok) {
          const recoverable = parseRecoverableGoLiveFailure(res);
          if (recoverable) {
            setLiveBot(recoverable.bot);
            setOnboarding((prev) =>
              prev
                ? {
                    ...prev,
                    onboardingStatus: 'live_pending_install',
                    onboardingCreatedBotId: recoverable.bot.id,
                    onboardingCurrentStep: 'you-are-live',
                  }
                : prev,
            );
            return {
              ok: false,
              error: recoverable.message,
              recoverable: true,
            };
          }
          return { ok: false, error: apiErrorMessage(res) };
        }

        const bot = res.data.bot;
        const botId = bot?.id;
        if (!botId || !bot) {
          return { ok: false, error: 'Go live succeeded but no bot was returned.' };
        }

        return {
          ok: true,
          botId,
          lifecycle: mapGoLiveBotToLifecycleResult(bot, botId),
        };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Failed to go live' };
      } finally {
        publishingRef.current = false;
      }
    },
    [workspaceId],
  );

  const publishForGoLive = useCallback(
    async (opts: { origin: string; label: string; completeOnly?: boolean }) => {
      if (publishingRef.current) {
        return { ok: false as const, error: 'Publish already in progress.' };
      }
      if (!workspaceId) {
        return { ok: false as const, error: 'Onboarding is not ready.' };
      }

      const existingBotId = liveBot?.id ?? onboarding?.onboardingCreatedBotId ?? null;
      if (opts.completeOnly) {
        if (!existingBotId) {
          return { ok: false as const, error: 'Your agent is not live yet.' };
        }
        publishingRef.current = true;
        try {
          return await finishOnboardingAndOpenDashboard(existingBotId);
        } finally {
          publishingRef.current = false;
        }
      }

      const goLive = await runOnboardingGoLive(opts);
      if (!goLive.ok) {
        return {
          ok: false as const,
          error: goLive.error,
          ...(goLive.recoverable ? { recoverable: true as const } : {}),
        };
      }

      await markStepDone('go-live');
      const finished = await finishOnboardingAndOpenDashboard(goLive.botId);
      if (!finished.ok) return finished;
      return {
        ok: true as const,
        ...(goLive.knowledgeProcessingWarning
          ? { knowledgeProcessingWarning: goLive.knowledgeProcessingWarning }
          : {}),
      };
    },
    [finishOnboardingAndOpenDashboard, liveBot, markStepDone, onboarding, runOnboardingGoLive, workspaceId],
  );

  const value = useMemo(
    () => ({
      phase,
      initError,
      workspaceId,
      onboarding,
      liveBot,
      stepsCompleted,
      reloadOnboarding,
      patchProfile,
      patchInstructions,
      patchKnowledge,
      patchGoLiveOrigins,
      markStepDone,
      goToNextAfter,
      publishForGoLive,
      runOnboardingGoLive,
      uploadAvatar,
      uploadOnboardingDocuments,
      uploadOnboardingDatasheet,
      deleteOnboardingDocument,
      deleteOnboardingDocuments,
      deleteOnboardingDatasheet,
      deleteOnboardingDatasheets,
      createOnboardingSnippet,
      updateOnboardingSnippet,
      deleteOnboardingSnippet,
      deleteOnboardingSnippets,
      createOnboardingQa,
      updateOnboardingQa,
      deleteOnboardingQa,
      deleteOnboardingQas,
      importOnboardingQas,
      importOnboardingSnippets,
      transcribeDescribeAgent,
      finishOnboarding,
    }),
    [
      phase,
      initError,
      workspaceId,
      onboarding,
      liveBot,
      stepsCompleted,
      reloadOnboarding,
      patchProfile,
      patchInstructions,
      patchKnowledge,
      patchGoLiveOrigins,
      markStepDone,
      goToNextAfter,
      publishForGoLive,
      runOnboardingGoLive,
      uploadAvatar,
      uploadOnboardingDocuments,
      uploadOnboardingDatasheet,
      deleteOnboardingDocument,
      deleteOnboardingDocuments,
      deleteOnboardingDatasheet,
      deleteOnboardingDatasheets,
      createOnboardingSnippet,
      updateOnboardingSnippet,
      deleteOnboardingSnippet,
      deleteOnboardingSnippets,
      createOnboardingQa,
      updateOnboardingQa,
      deleteOnboardingQa,
      deleteOnboardingQas,
      importOnboardingQas,
      importOnboardingSnippets,
      transcribeDescribeAgent,
      finishOnboarding,
    ],
  );

  return <OnboardingFlowContext.Provider value={value}>{children}</OnboardingFlowContext.Provider>;
}

export function useOnboardingFlow() {
  const ctx = useContext(OnboardingFlowContext);
  if (!ctx) {
    throw new Error('useOnboardingFlow must be used within OnboardingFlowProvider');
  }
  return ctx;
}
