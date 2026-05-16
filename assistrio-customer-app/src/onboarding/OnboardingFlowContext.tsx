import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { EXAMPLE_QUESTIONS_MAX } from '../pages/bot-workspace/behaviorConstants';
import {
  getCustomerBot,
  getCustomerBots,
  patchCustomerBot,
  patchCustomerKnowledgeDescription,
  postCustomerBotDraft,
  postCustomerBotDraftFinalize,
  postCustomerKnowledgeDatasheet,
  postCustomerKnowledgeFaq,
  postCustomerKnowledgeSnippet,
  postCustomerKnowledgeSuggestion,
} from '../api/customerApi';
import type { CustomerBotDetail, CustomerBotListItem } from '../api/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { buildFinalizePayloadFromBot } from './buildFinalizePayload';
import { mergeStepsCompleted } from './onboardingProgress';
import { nextStepPath } from './onboardingState';
import {
  clearEphemeralClientDraftId,
  clearOnboardingSession,
  markCustomerSetupFinished,
  readOnboardingSession,
  takeOrCreateEphemeralClientDraftId,
  writeOnboardingSession,
  type OnboardingSessionV1,
} from './onboardingSessionStorage';

function pickDraftBot(bots: CustomerBotListItem[]): CustomerBotListItem | null {
  const drafts = bots.filter((b) => b.status === 'draft');
  if (drafts.length === 0) return null;
  drafts.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return drafts[0] ?? null;
}

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

type OnboardingFlowValue = {
  phase: FlowPhase;
  initError: string | null;
  bot: CustomerBotDetail | null;
  botId: string | null;
  clientDraftId: string | null;
  stepsCompleted: string[];
  reloadBot: () => Promise<void>;
  patchDraft: (body: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>;
  markStepDone: (path: string) => void;
  goToNextAfter: (currentPath: string) => void;
  completeWizard: (opts: {
    publish: boolean;
    origin: string;
    label: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const OnboardingFlowContext = createContext<OnboardingFlowValue | null>(null);

export function OnboardingFlowProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { refresh } = useCustomerAuth();
  const [phase, setPhase] = useState<FlowPhase>('loading');
  const [initError, setInitError] = useState<string | null>(null);
  const [bot, setBot] = useState<CustomerBotDetail | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [clientDraftId, setClientDraftId] = useState<string | null>(null);
  const [stepsCompleted, setStepsCompleted] = useState<string[]>([]);

  const reloadBot = useCallback(async () => {
    if (!botId) return;
    const res = await getCustomerBot(botId);
    if (res.ok) {
      setBot(res.data.bot as CustomerBotDetail);
    }
  }, [botId]);

  const persistSession = useCallback((s: OnboardingSessionV1) => {
    writeOnboardingSession(s);
    setStepsCompleted(s.stepsCompleted);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('loading');
      setInitError(null);
      try {
        const allRes = await getCustomerBots();
        if (!allRes.ok) throw new Error(allRes.error);
        const bots = allRes.data;

        let sess = readOnboardingSession();

        const loadDraft = async (
          id: string,
        ): Promise<{ bot: CustomerBotDetail; clientDraftFromApi: string | null } | null> => {
          const r = await getCustomerBot(id);
          if (!r.ok || cancelled) return null;
          const b = r.data.bot as CustomerBotDetail;
          if (b.status !== 'draft') return null;
          const cd =
            typeof b.clientDraftId === 'string' && b.clientDraftId.trim()
              ? b.clientDraftId.trim()
              : null;
          return { bot: b, clientDraftFromApi: cd };
        };

        let resolvedBotId: string | null = null;
        let resolvedClientId: string | null = null;
        let loaded: { bot: CustomerBotDetail; clientDraftFromApi: string | null } | null = null;

        if (sess?.botId && sess.clientDraftId) {
          const h = await loadDraft(sess.botId);
          if (h) {
            const apiId = h.clientDraftFromApi;
            if (!apiId || apiId === sess.clientDraftId) {
              resolvedBotId = sess.botId;
              resolvedClientId = apiId ?? sess.clientDraftId;
              loaded = h;
            }
          }
        }

        if (!loaded) {
          const draftRow = pickDraftBot(bots);
          if (draftRow) {
            const h = await loadDraft(draftRow._id);
            if (h?.clientDraftFromApi) {
              resolvedBotId = draftRow._id;
              resolvedClientId = h.clientDraftFromApi;
              loaded = h;
            } else if (h) {
              throw new Error(
                'This draft is missing client metadata. Please update the API or create a new draft assistant.',
              );
            }
          }
        }

        let createdDraftViaEphemeralLock = false;
        if (!loaded) {
          createdDraftViaEphemeralLock = true;
          const nu = takeOrCreateEphemeralClientDraftId();
          const cr = await postCustomerBotDraft({ clientDraftId: nu });
          if (!cr.ok || cancelled) {
            clearEphemeralClientDraftId();
            throw new Error(cr.ok ? 'Cancelled' : cr.error);
          }
          const h = await loadDraft(cr.data.botId);
          if (!h || cancelled) {
            clearEphemeralClientDraftId();
            throw new Error('Could not load the new draft.');
          }
          resolvedBotId = cr.data.botId;
          resolvedClientId = nu;
          loaded = h;
        }

        if (cancelled || !resolvedBotId || !resolvedClientId || !loaded) {
          throw new Error('Could not prepare onboarding draft.');
        }

        const baseSession: OnboardingSessionV1 = {
          v: 1,
          botId: resolvedBotId,
          clientDraftId: resolvedClientId,
          stepsCompleted: sess?.botId === resolvedBotId ? sess.stepsCompleted : [],
        };
        const merged = mergeStepsCompleted(baseSession, loaded.bot);

        setBot(loaded.bot);
        setBotId(resolvedBotId);
        setClientDraftId(resolvedClientId);
        persistSession({ ...baseSession, stepsCompleted: merged });
        if (createdDraftViaEphemeralLock) {
          clearEphemeralClientDraftId();
        }
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        setInitError(e instanceof Error ? e.message : 'Setup failed');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistSession]);

  const markStepDone = useCallback(
    (path: string) => {
      setStepsCompleted((prev) => {
        if (prev.includes(path)) {
          const s = readOnboardingSession();
          if (s) writeOnboardingSession({ ...s, stepsCompleted: prev });
          return prev;
        }
        const next = [...prev, path];
        const s = readOnboardingSession();
        if (s && s.botId === botId) {
          writeOnboardingSession({ ...s, stepsCompleted: next });
        }
        return next;
      });
    },
    [botId],
  );

  const patchDraft = useCallback(
    async (body: Record<string, unknown>) => {
      if (!botId) return { ok: false as const, error: 'No draft bot' };
      const rest: Record<string, unknown> = { ...body };
      if ('faqs' in rest) {
        const raw = rest.faqs;
        delete rest.faqs;
        const list = Array.isArray(raw) ? raw : [];
        for (const item of list) {
          if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
          const fq = await postCustomerKnowledgeFaq(botId, item as Record<string, unknown>);
          if (!fq.ok) return { ok: false as const, error: fq.error };
        }
      }
      if ('knowledgeSnippets' in rest) {
        const raw = rest.knowledgeSnippets;
        delete rest.knowledgeSnippets;
        const list = Array.isArray(raw) ? raw : [];
        for (const item of list) {
          if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
          const r = await postCustomerKnowledgeSnippet(botId, item as Record<string, unknown>);
          if (!r.ok) return { ok: false as const, error: r.error };
        }
      }
      const tablesRaw =
        ('knowledgeDatasheets' in rest ? rest.knowledgeDatasheets : undefined) ??
        ('knowledgeTables' in rest ? rest.knowledgeTables : undefined);
      if ('knowledgeDatasheets' in rest) delete rest.knowledgeDatasheets;
      if ('knowledgeTables' in rest) delete rest.knowledgeTables;
      if (tablesRaw !== undefined) {
        const list = Array.isArray(tablesRaw) ? tablesRaw : [];
        for (const item of list) {
          if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
          const r = await postCustomerKnowledgeDatasheet(botId, item as Record<string, unknown>);
          if (!r.ok) return { ok: false as const, error: r.error };
        }
      }
      if ('exampleQuestions' in rest) {
        const raw = rest.exampleQuestions;
        delete rest.exampleQuestions;
        const list = (Array.isArray(raw) ? raw : []).slice(0, EXAMPLE_QUESTIONS_MAX);
        for (const item of list) {
          if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
          const r = await postCustomerKnowledgeSuggestion(botId, item as Record<string, unknown>);
          if (!r.ok) return { ok: false as const, error: r.error };
        }
      }
      if ('knowledgeDescription' in rest) {
        const kd = rest.knowledgeDescription;
        delete rest.knowledgeDescription;
        const d = await patchCustomerKnowledgeDescription(botId, { knowledgeDescription: String(kd ?? '') });
        if (!d.ok) return { ok: false as const, error: d.error };
      }
      if (Object.keys(rest).length > 0) {
        const res = await patchCustomerBot(botId, rest);
        if (!res.ok) return { ok: false as const, error: res.error };
      }
      await reloadBot();
      return { ok: true as const };
    },
    [botId, reloadBot],
  );

  const goToNextAfter = useCallback(
    (currentPath: string) => {
      const n = nextStepPath(currentPath);
      if (n) navigate(`/onboarding/${n}`);
      else navigate('/bots');
    },
    [navigate],
  );

  const completeWizard = useCallback(
    async (opts: { publish: boolean; origin: string; label: string }) => {
      try {
        if (!opts.publish) {
          markCustomerSetupFinished();
          clearOnboardingSession();
          await refresh();
          navigate('/bots', { replace: true });
          return { ok: true as const };
        }
        if (!clientDraftId || !botId) {
          return { ok: false as const, error: 'Onboarding is not ready.' };
        }
        const originNorm = normalizeOriginForSave(opts.origin);
        if (!originNorm) {
          return {
            ok: false as const,
            error:
              'Enter a valid website URL (https://…). Localhost cannot be saved as an allowed embed origin.',
          };
        }
        const allowedOrigins = [
          {
            origin: originNorm,
            ...(opts.label.trim() ? { label: opts.label.trim() } : {}),
            isActive: true,
          },
        ];
        const patchRes = await patchCustomerBot(botId, { allowedOrigins });
        if (!patchRes.ok) return { ok: false as const, error: patchRes.error };

        const fresh = await getCustomerBot(botId);
        if (!fresh.ok) return { ok: false as const, error: fresh.error };
        const b = fresh.data.bot as CustomerBotDetail;
        const payload = buildFinalizePayloadFromBot(b, {
          allowedOrigins,
          status: 'published',
          isPublic: true,
          visibility: 'public',
        });
        const fin = await postCustomerBotDraftFinalize({ clientDraftId, payload });
        if (!fin.ok) return { ok: false as const, error: fin.error };

        markCustomerSetupFinished();
        clearOnboardingSession();
        await refresh();
        navigate('/bots', { replace: true });
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : 'Failed to finish' };
      }
       },
    [botId, clientDraftId, navigate, refresh],
  );

  const value = useMemo(
    () => ({
      phase,
      initError,
      bot,
      botId,
      clientDraftId,
      stepsCompleted,
      reloadBot,
      patchDraft,
      markStepDone,
      goToNextAfter,
      completeWizard,
    }),
    [
      phase,
      initError,
      bot,
      botId,
      clientDraftId,
      stepsCompleted,
      reloadBot,
      patchDraft,
      markStepDone,
      goToNextAfter,
      completeWizard,
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

