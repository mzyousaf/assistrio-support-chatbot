import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Check,
  FilePenLine,
  Loader2,
  PencilLine,
  Rocket,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { postCustomerBotLifecycleAction } from '../api/customerApi';
import type { CustomerBotLifecycleResponse } from '../api/types';
import { PostPublishInstallPanel } from '@/components/go-live/PostPublishInstallPanel';
import { getCustomerAppPublicOrigin, iframeEmbedSnippet } from '@/lib/embedOrigin';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

const PUBLISH_STEPS = [
  'Verifying allowed origins…',
  'Analyzing knowledge base…',
  'Configuring AI settings…',
  'Preparing deployment settings…',
  'Activating your agent…',
] as const;

const GOING_TO_DASHBOARD_STEP = 'Going to dashboard…';

const DRAFT_STEPS = [
  'Deactivating agent…',
  'Moving agent to draft…',
  'Finalizing draft state…',
] as const;

const LAST_STEP_DWELL_MS = 550;

type Phase = 'running' | 'success' | 'error';

function HeaderIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&_svg]:shrink-0',
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

export type PublishLifecycleResult = Extract<CustomerBotLifecycleResponse, { action: 'publish' }>;

export type BotLifecyclePublishRunnerResult =
  | { ok: true; botId: string; data: PublishLifecycleResult }
  | { ok: false; error: string };

export function BotLifecycleModal({
  open,
  runKey,
  action,
  botId,
  publishRunner,
  onBusyChange,
  onClose,
  onSuccess,
  openingDashboard = false,
  navigateToDashboardAfterPublish = false,
  initialDashboardNavigation = false,
}: {
  open: boolean;
  runKey: number;
  action: 'publish' | 'draft' | null;
  botId: string | null;
  /** When set (onboarding go-live), runs instead of POST lifecycle-action. */
  publishRunner?: () => Promise<BotLifecyclePublishRunnerResult>;
  onBusyChange?: (busy: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  /** Keep success UI visible and block dismiss while routing to dashboard (onboarding). */
  openingDashboard?: boolean;
  /** After publish API success, stay on progress UI with a final "Going to dashboard…" step (onboarding). */
  navigateToDashboardAfterPublish?: boolean;
  /** Restore the dashboard navigation step after route change (onboarding overlay). */
  initialDashboardNavigation?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('running');
  const [stepIndex, setStepIndex] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerBotLifecycleResponse | null>(null);
  const [pendingSuccess, setPendingSuccess] = useState<CustomerBotLifecycleResponse | null>(null);
  const [resolvedBotId, setResolvedBotId] = useState<string | null>(botId);
  const [dashboardNavigationActive, setDashboardNavigationActive] = useState(initialDashboardNavigation);

  const progressIntervalRef = useRef<number | null>(null);
  const successFlushGuardRef = useRef(false);
  const lastStepDwellTimeoutRef = useRef<number | null>(null);

  const isPublish = action === 'publish';
  const activeBotId = resolvedBotId ?? botId;

  useEffect(() => {
    onBusyChange?.(open && phase === 'running');
  }, [open, phase, onBusyChange]);

  useEffect(() => {
    if (!open) {
      setPhase('running');
      setStepIndex(0);
      setErrMsg(null);
      setResult(null);
      setPendingSuccess(null);
      setResolvedBotId(botId);
      setDashboardNavigationActive(false);
      successFlushGuardRef.current = false;
      if (lastStepDwellTimeoutRef.current != null) {
        window.clearTimeout(lastStepDwellTimeoutRef.current);
        lastStepDwellTimeoutRef.current = null;
      }
    }
  }, [open, botId]);

  useEffect(() => {
    if (open && (!action || (!botId && !publishRunner))) {
      onBusyChange?.(false);
    }
  }, [open, action, botId, publishRunner, onBusyChange]);

  useEffect(() => {
    if (!open || !action) return;
    if (initialDashboardNavigation) {
      setPhase('running');
      setDashboardNavigationActive(true);
      setStepIndex(PUBLISH_STEPS.length);
      setResolvedBotId(botId);
      setErrMsg(null);
      setPendingSuccess(null);
      setResult(null);
      return;
    }
    if (!publishRunner && !botId) return;
    let cancelled = false;
    const animationCap =
      action === 'publish' && navigateToDashboardAfterPublish
        ? PUBLISH_STEPS.length - 1
        : (action === 'publish' ? PUBLISH_STEPS : DRAFT_STEPS).length - 1;

    successFlushGuardRef.current = false;
    setPhase('running');
    setStepIndex(0);
    setErrMsg(null);
    setResult(null);
    setPendingSuccess(null);
    setResolvedBotId(botId);

    const clearProgressInterval = () => {
      if (progressIntervalRef.current != null) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };

    const iv = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, animationCap));
    }, 820);
    progressIntervalRef.current = iv;

    void (async () => {
      let res:
        | { ok: true; data: CustomerBotLifecycleResponse }
        | { ok: false; error: string };

      if (action === 'publish' && publishRunner) {
        const custom = await publishRunner();
        if (custom.ok) {
          setResolvedBotId(custom.botId);
          res = { ok: true, data: custom.data };
        } else {
          res = { ok: false, error: custom.error };
        }
      } else if (botId) {
        res = await postCustomerBotLifecycleAction(botId, action);
      } else {
        res = { ok: false, error: 'Agent is not ready.' };
      }

      if (cancelled) {
        clearProgressInterval();
        return;
      }
      if (!res.ok) {
        clearProgressInterval();
        setPhase('error');
        setErrMsg(res.error || 'Request failed');
        return;
      }
      setPendingSuccess(res.data);
    })();

    return () => {
      cancelled = true;
      clearProgressInterval();
      if (lastStepDwellTimeoutRef.current != null) {
        window.clearTimeout(lastStepDwellTimeoutRef.current);
        lastStepDwellTimeoutRef.current = null;
      }
    };
  }, [open, runKey, action, botId, publishRunner, initialDashboardNavigation, navigateToDashboardAfterPublish]);

  useEffect(() => {
    if (!open || phase !== 'running' || !pendingSuccess || !action) {
      if (lastStepDwellTimeoutRef.current != null) {
        window.clearTimeout(lastStepDwellTimeoutRef.current);
        lastStepDwellTimeoutRef.current = null;
      }
      return;
    }
    const stepCount = (action === 'publish' ? PUBLISH_STEPS : DRAFT_STEPS).length;
    if (stepIndex < stepCount - 1) {
      if (lastStepDwellTimeoutRef.current != null) {
        window.clearTimeout(lastStepDwellTimeoutRef.current);
        lastStepDwellTimeoutRef.current = null;
      }
      return;
    }
    if (successFlushGuardRef.current) return;
    if (lastStepDwellTimeoutRef.current != null) return;

    lastStepDwellTimeoutRef.current = window.setTimeout(() => {
      lastStepDwellTimeoutRef.current = null;
      if (successFlushGuardRef.current) return;
      successFlushGuardRef.current = true;

      if (progressIntervalRef.current != null) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      setResult(pendingSuccess);
      setPendingSuccess(null);

      if (navigateToDashboardAfterPublish && action === 'publish') {
        setDashboardNavigationActive(true);
        setStepIndex(PUBLISH_STEPS.length);
        onSuccess();
        return;
      }

      setPhase('success');
      onSuccess();
    }, LAST_STEP_DWELL_MS);

    return () => {
      if (lastStepDwellTimeoutRef.current != null) {
        window.clearTimeout(lastStepDwellTimeoutRef.current);
        lastStepDwellTimeoutRef.current = null;
      }
    };
  }, [open, phase, pendingSuccess, stepIndex, action, navigateToDashboardAfterPublish, onSuccess]);

  const title =
    action === 'publish'
      ? 'Going live'
      : action === 'draft'
        ? 'Going to draft'
        : 'Agent';

  const modalTitle: ReactNode =
    phase === 'running' && action === 'publish' ? (
      <span className="inline-flex items-center gap-3">
        <HeaderIcon className="border-2 border-teal-100 bg-teal-50 text-teal-600">
          <Rocket className="h-5 w-5" strokeWidth={1.75} />
        </HeaderIcon>
        Going live
      </span>
    ) : phase === 'running' && action === 'draft' ? (
      <span className="inline-flex items-center gap-3">
        <HeaderIcon className="border-2 border-slate-200 bg-slate-50 text-slate-600">
          <PencilLine className="h-5 w-5" strokeWidth={1.75} />
        </HeaderIcon>
        Going to draft
      </span>
    ) : phase === 'success' && result?.action === 'publish' ? (
      <span className="inline-flex items-center gap-3">
        <HeaderIcon className="bg-teal-100 text-teal-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
          <BadgeCheck className="h-5 w-5" strokeWidth={2} />
        </HeaderIcon>
        You&apos;re live
      </span>
    ) : phase === 'success' && result?.action === 'draft' ? (
      <span className="inline-flex items-center gap-3">
        <HeaderIcon className="border border-slate-200/80 bg-slate-50 text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04]">
          <FilePenLine className="h-5 w-5" strokeWidth={2} />
        </HeaderIcon>
        You&apos;re in draft
      </span>
    ) : (
      title
    );

  const modalDescription =
    phase === 'running' ? (
      <span className="text-slate-600">
        {isPublish
          ? 'Hang tight while we take your agent live on your allowed websites.'
          : 'Hang tight while we move your agent to draft—changes stay in this workspace until you publish again.'}
      </span>
    ) : phase === 'success' ? (
      result?.action === 'publish' ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-slate-600">
            Paste the snippet on your site, or open{' '}
            <span className="font-medium text-slate-800">Deploy & Go Live</span> anytime to update keys and allowed sites.
          </span>
          {activeBotId ? (
            <Link
              to={`/bots/${activeBotId}/playground/deploy`}
              className="inline-flex w-fit max-w-full items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-[3px] decoration-primary/35 transition-colors hover:text-[var(--teal-800)] hover:decoration-[var(--teal-800)]/50 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              onClick={onClose}
            >
              <BookOpen size={16} strokeWidth={2} className="shrink-0 text-primary" aria-hidden />
              Install guide & embed settings
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className="text-slate-600">
            Your allowed websites no longer show this agent in the embed. You can keep working here; nothing goes live on
            those sites until you publish again.
          </span>
          {activeBotId ? (
            <Link
              to={`/bots/${activeBotId}/playground/deploy`}
              className="inline-flex w-fit max-w-full items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-[3px] decoration-primary/35 transition-colors hover:text-[var(--teal-800)] hover:decoration-[var(--teal-800)]/50 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              onClick={onClose}
            >
              <BookOpen size={16} strokeWidth={2} className="shrink-0 text-primary" aria-hidden />
              Open Deploy & Go Live
            </Link>
          ) : null}
        </div>
      )
    ) : undefined;

  const allowDismiss =
    phase !== 'running' && !openingDashboard && !dashboardNavigationActive && !initialDashboardNavigation;

  const publishIframeSnippet = useMemo(() => {
    if (result?.action !== 'publish' || !activeBotId) return '';
    return iframeEmbedSnippet({
      appOrigin: getCustomerAppPublicOrigin(),
      botId: activeBotId,
      accessKey: result.accessKey,
    });
  }, [result, activeBotId]);

  const steps =
    action === 'publish' &&
    (navigateToDashboardAfterPublish || dashboardNavigationActive || initialDashboardNavigation)
      ? [...PUBLISH_STEPS, GOING_TO_DASHBOARD_STEP]
      : action === 'publish'
        ? PUBLISH_STEPS
        : action === 'draft'
          ? DRAFT_STEPS
          : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      size="md"
      allowDismiss={allowDismiss}
      className="max-h-[min(92vh,52rem)] max-w-md"
      bodyClassName="py-4 sm:py-5"
      footer={
        phase === 'success' && result?.action === 'draft' ? (
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-teal-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 sm:w-auto"
            onClick={onClose}
          >
            Got it
          </button>
        ) : phase === 'error' ? (
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        ) : null
      }
    >
      {phase === 'running' ? (
        <div className="-mt-0.5 space-y-4" role="status" aria-live="polite">
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-medium text-slate-600">
                {steps.length ? (
                  <>
                    Step {stepIndex + 1} of {steps.length}
                  </>
                ) : (
                  'Progress'
                )}
              </span>
              <span className="tabular-nums text-slate-400">
                {steps.length ? Math.round(((stepIndex + 1) / steps.length) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-300 ease-out',
                  isPublish
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600'
                    : 'bg-gradient-to-r from-slate-500 to-slate-600',
                )}
                style={{
                  width: `${steps.length ? ((stepIndex + 1) / steps.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <ul className="m-0 list-none space-y-1 p-0" aria-label="Setup steps">
            {steps.map((label, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              return (
                <li
                  key={label}
                  className={cn(
                    'flex items-start gap-3 rounded-lg py-2 pl-1.5 pr-2 text-sm transition-colors',
                    current && 'bg-slate-50 ring-1 ring-slate-200/80',
                  )}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                    {done ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50">
                        <Check className="h-3.5 w-3.5 text-teal-600" strokeWidth={2.5} />
                      </span>
                    ) : current ? (
                      <Loader2
                        className={cn('h-4 w-4 animate-spin', isPublish ? 'text-teal-600' : 'text-slate-600')}
                        strokeWidth={2}
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center">
                        <span className="block h-2 w-2 rounded-full bg-slate-200" />
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 leading-snug',
                      done && 'text-slate-500',
                      !done && !current && 'text-slate-400',
                      current && 'font-medium text-slate-900',
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {phase === 'success' ? (
        <div className="space-y-4">
          {result?.action === 'draft' ? (
            <ul
              className="m-0 list-none space-y-2.5 p-0 text-sm leading-snug text-slate-600"
              aria-label="What changed in draft mode"
            >
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.5} aria-hidden />
                <span>Edits stay in this workspace only—they are not shown on your websites until you publish again.</span>
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.5} aria-hidden />
                <span>On your allowed websites, the embed stays on the last published version until you go live from Deploy & Go Live.</span>
              </li>
            </ul>
          ) : null}

          {result?.action === 'publish' && result.embedSnippet ? (
            <PostPublishInstallPanel
              allowedOrigins={result.allowedOrigins ?? []}
              widgetSnippet={result.embedSnippet}
              iframeSnippet={publishIframeSnippet}
            />
          ) : null}
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} aria-hidden />
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-amber-950">Something went wrong</p>
            <p className="mt-1 m-0 text-sm text-amber-950/90">{errMsg ?? 'Please try again.'}</p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
