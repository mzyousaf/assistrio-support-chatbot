import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Check, ChevronDown, Globe, Lightbulb, X } from 'lucide-react';
import { useOnboardingFlow, normalizeOriginForSave } from '../../onboarding/OnboardingFlowContext';
import { useOnboardingStepUi } from '../../onboarding/OnboardingStepUiContext';
import { useRegisterOnboardingStepActions } from '../../onboarding/OnboardingStepActionsContext';
import { isGoLiveStepDirty } from '../../onboarding/onboardingStepDirty';
import { useRegisterOnboardingStepGuard } from '../../onboarding/useRegisterOnboardingStepGuard';
import { BotLifecycleModal, type PublishLifecycleResult } from '@/components/BotLifecycleModal';
import { GoLiveConfirmModal } from '@/components/go-live/GoLiveConfirmModal';
import { onboardingPublishWhatHappensNextItems } from '@/components/go-live/goLiveConfirmCopy';
import { useGoLivePublishOverlay } from '@/onboarding/goLivePublishOverlay';
import { FieldRow, Input } from '@/components/ui';
import { OriginLabelField } from '@/components/onboarding/OriginLabelField';
import { OnboardingSectionHeading } from '@/components/onboarding/OnboardingSectionHeading';
import { OnboardingStepPanel } from '@/components/onboarding/OnboardingStepPanel';
import { cn } from '@/lib/utils';
import { styles } from './onboardingStep';

const STEP = 'go-live';

const SUBTITLE =
  'Choose where your AI Agent can run. We’ll publish it and open installation options on your dashboard.';

const PLAN_LIMIT_FRIENDLY =
  'Your current plan allows 1 agent. Delete an unused agent or upgrade to publish another one.';

const VALID_ORIGIN_EXAMPLES = [
  'https://example.com',
  'https://www.example.com',
  'https://app.example.com',
] as const;

const INVALID_ORIGIN_EXAMPLES = ['example.com', 'https://example.com/pricing', 'localhost'] as const;

function isOriginRelatedError(message: string): boolean {
  return /valid website URL|localhost|allowed embed origin|website URL \(allowed origin\) is required|required/i.test(
    message,
  );
}

function isPlanLimitError(message: string): boolean {
  return /bot limit|plan_limit_workspace_bots|reached the bot limit/i.test(message);
}

function formatGoLiveApiError(message: string): { originField?: string; alert?: string } {
  if (isPlanLimitError(message)) {
    return { alert: PLAN_LIMIT_FRIENDLY };
  }
  if (isOriginRelatedError(message)) {
    return { originField: message };
  }
  return { alert: message };
}

function GoLiveApiAlert({ message }: { message: string }) {
  return (
    <div className="onboarding-go-live-alert" role="alert">
      <p className="m-0 text-[0.875rem] leading-relaxed text-[var(--color-danger-text-emphasis)]">{message}</p>
    </div>
  );
}

function OriginExamplesContent() {
  return (
    <div className="onboarding-go-live-examples-grid">
      <div>
        <p className="onboarding-go-live-examples-label onboarding-go-live-examples-label--valid">Valid</p>
        <ul className="onboarding-go-live-examples-list">
          {VALID_ORIGIN_EXAMPLES.map((item) => (
            <li key={item}>
              <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
              <code>{item}</code>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="onboarding-go-live-examples-label onboarding-go-live-examples-label--invalid">Invalid</p>
        <ul className="onboarding-go-live-examples-list">
          {INVALID_ORIGIN_EXAMPLES.map((item) => (
            <li key={item}>
              <X className="size-3.5 shrink-0 text-red-500" aria-hidden />
              <code>{item}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function OnboardingGoLiveStep() {
  const { onboarding, liveBot, patchGoLiveOrigins, runOnboardingGoLive, markStepDone, finishOnboarding } =
    useOnboardingFlow();
  const { pinDashboardNavigation, clearPublishSuccessOverlay, dashboardNavigationPinned } =
    useGoLivePublishOverlay();
  const { markStepAttemptFailed, clearStepAttempt, setSavingStepId } = useOnboardingStepUi();
  const [origin, setOrigin] = useState('');
  const [label, setLabel] = useState('');
  const [originFieldError, setOriginFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmingGoLive, setConfirmingGoLive] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleRunKey, setLifecycleRunKey] = useState(0);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [openDashboardError, setOpenDashboardError] = useState<string | null>(null);
  const [routingToDashboard, setRoutingToDashboard] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const publishedBotIdRef = useRef<string | null>(null);
  const publishedLifecycleRef = useRef<PublishLifecycleResult | null>(null);
  const lifecycleSucceededRef = useRef(false);
  const completingDashboardRef = useRef(false);
  const goLiveOriginRef = useRef('');
  const goLiveLabelRef = useRef('');

  const existingLiveBotId = liveBot?.id ?? onboarding?.onboardingCreatedBotId ?? null;

  const alreadyLive =
    Boolean(liveBot) ||
    onboarding?.onboardingStatus === 'live_pending_install' ||
    Boolean(onboarding?.onboardingCreatedBotId);

  const goLiveFlowActive = lifecycleOpen || routingToDashboard;

  const completeGoLiveAndOpenDashboard = useCallback(async () => {
    if (completingDashboardRef.current || !lifecycleSucceededRef.current) return;
    const botId = publishedBotIdRef.current;
    if (!botId) return;

    completingDashboardRef.current = true;
    setRoutingToDashboard(true);
    setOpenDashboardError(null);
    flushSync(() => {
      pinDashboardNavigation({ botId });
    });
    try {
      await markStepDone('go-live');
      await finishOnboarding({
        liveBotId: botId,
        showInstall: true,
      });
    } catch (err) {
      completingDashboardRef.current = false;
      setRoutingToDashboard(false);
      clearPublishSuccessOverlay();
      setOpenDashboardError(err instanceof Error ? err.message : 'Could not open your dashboard.');
    }
  }, [clearPublishSuccessOverlay, finishOnboarding, markStepDone, pinDashboardNavigation]);

  useEffect(() => {
    if (!alreadyLive || !existingLiveBotId || completingDashboardRef.current) return;
    if (goLiveFlowActive) return;
    completingDashboardRef.current = true;
    setOpenDashboardError(null);
    void finishOnboarding({ liveBotId: existingLiveBotId, showInstall: true }).catch((err) => {
      completingDashboardRef.current = false;
      setOpenDashboardError(err instanceof Error ? err.message : 'Could not open your dashboard.');
    });
  }, [alreadyLive, existingLiveBotId, finishOnboarding, goLiveFlowActive]);

  useEffect(() => {
    const ao = onboarding?.draft.goLive.allowedOrigins ?? liveBot?.allowedOrigins ?? [];
    const first = ao.find((o) => String(o.origin ?? '').trim());
    if (first) {
      setOrigin(String(first.origin));
      setLabel(typeof first.label === 'string' ? first.label : '');
    }
  }, [onboarding?.workspaceId, onboarding?.draft.goLive.allowedOrigins, liveBot]);

  const savedOrigins = onboarding?.draft.goLive.allowedOrigins ?? liveBot?.allowedOrigins ?? [];

  const hydrateFromDraft = useCallback(() => {
    const first = savedOrigins.find((o) => String(o.origin ?? '').trim());
    if (first) {
      setOrigin(String(first.origin));
      setLabel(typeof first.label === 'string' ? first.label : '');
    } else {
      setOrigin('');
      setLabel('');
    }
    setOriginFieldError(null);
    setApiError(null);
  }, [savedOrigins]);

  const persistGoLiveDraft = useCallback(async (): Promise<boolean> => {
    setOriginFieldError(null);
    setApiError(null);
    const trimmedOrigin = origin.trim();
    if (!trimmedOrigin) {
      setOriginFieldError('Website URL (allowed origin) is required.');
      return false;
    }
    const originNorm = normalizeOriginForSave(trimmedOrigin);
    if (!originNorm) {
      setOriginFieldError(
        'Enter a valid website URL (https://…). Localhost cannot be saved as an allowed embed origin.',
      );
      return false;
    }

    const res = await patchGoLiveOrigins({
      allowedOrigins: [
        {
          origin: originNorm,
          ...(label.trim() ? { label: label.trim() } : {}),
          isActive: true,
        },
      ],
    });
    if (!res.ok) {
      const formatted = formatGoLiveApiError(res.error);
      setOriginFieldError(formatted.originField ?? null);
      setApiError(formatted.alert ?? null);
      return false;
    }
    return true;
  }, [label, origin, patchGoLiveOrigins]);

  useRegisterOnboardingStepGuard({
    isDirty: () => isGoLiveStepDirty({ origin, label, allowedOrigins: savedOrigins }),
    discard: hydrateFromDraft,
    save: persistGoLiveDraft,
  });

  const normalizedOrigin = useMemo(() => {
    const trimmed = origin.trim();
    if (!trimmed) return null;
    return normalizeOriginForSave(trimmed);
  }, [origin]);

  const whatHappensNext = useMemo(
    () => onboardingPublishWhatHappensNextItems(normalizedOrigin),
    [normalizedOrigin],
  );

  const publishRunner = useCallback(async () => {
    const res = await runOnboardingGoLive({
      origin: goLiveOriginRef.current,
      label: goLiveLabelRef.current,
    });
    if (!res.ok) {
      const formatted = formatGoLiveApiError(res.error);
      setOriginFieldError(formatted.originField ?? null);
      setApiError(formatted.alert ?? null);
      return { ok: false as const, error: res.error };
    }
    publishedBotIdRef.current = res.botId;
    publishedLifecycleRef.current = res.lifecycle;
    return { ok: true as const, botId: res.botId, data: res.lifecycle };
  }, [runOnboardingGoLive]);

  const requestGoLive = useCallback(() => {
    setOriginFieldError(null);
    setApiError(null);
    const o = origin.trim();
    if (!o) {
      setOriginFieldError('Website URL (allowed origin) is required.');
      markStepAttemptFailed(STEP);
      return;
    }
    if (!normalizeOriginForSave(o)) {
      setOriginFieldError(
        'Enter a valid website URL (https://…). Localhost cannot be saved as an allowed embed origin.',
      );
      markStepAttemptFailed(STEP);
      return;
    }
    clearStepAttempt(STEP);
    goLiveOriginRef.current = o;
    goLiveLabelRef.current = label;
    setConfirmOpen(true);
  }, [clearStepAttempt, label, markStepAttemptFailed, origin]);

  async function confirmGoLive() {
    setConfirmingGoLive(true);
    setSavingStepId(STEP);
    try {
      const saved = await persistGoLiveDraft();
      if (!saved) {
        markStepAttemptFailed(STEP);
        return;
      }
      setConfirmOpen(false);
      lifecycleSucceededRef.current = false;
      publishedBotIdRef.current = null;
      publishedLifecycleRef.current = null;
      setLifecycleRunKey((k) => k + 1);
      setLifecycleOpen(true);
    } finally {
      setConfirmingGoLive(false);
      setSavingStepId(null);
    }
  }

  async function onLifecycleClose() {
    if (lifecycleSucceededRef.current) {
      await completeGoLiveAndOpenDashboard();
      return;
    }
    setLifecycleOpen(false);
  }

  function onLifecycleSuccess() {
    lifecycleSucceededRef.current = true;
    setRoutingToDashboard(true);
    void completeGoLiveAndOpenDashboard();
  }

  useRegisterOnboardingStepActions({
    primaryLabel: lifecycleBusy ? 'Publishing…' : confirmingGoLive ? 'Going live…' : 'Go Live',
    primaryType: 'button',
    primaryLoading: lifecycleBusy || confirmingGoLive,
    primaryDisabled: lifecycleBusy || confirmOpen || confirmingGoLive,
    onPrimary: requestGoLive,
  });

  if (alreadyLive && !goLiveFlowActive) {
    return (
      <OnboardingStepPanel
        stepId={STEP}
        className="onboarding-go-live-step"
        headerClassName="go-live-header"
        eyebrow="Go live"
        title="Publish Your AI Agent"
        description="Your AI Agent is already published and live."
      >
        {openDashboardError ? (
          <div className="onboarding-go-live-body">
            <GoLiveApiAlert message={openDashboardError} />
          </div>
        ) : null}
      </OnboardingStepPanel>
    );
  }

  return (
    <>
      <OnboardingStepPanel
        stepId={STEP}
        className="onboarding-go-live-step"
        headerClassName="go-live-header"
        eyebrow="Go live"
        title="Publish Your AI Agent"
        description={SUBTITLE}
      >
        <div className="onboarding-go-live-body">
          <section className="onboarding-go-live-card" aria-labelledby="onb-go-live-origin-heading">
            <header className="onboarding-go-live-card-header">
              <OnboardingSectionHeading icon={Globe} id="onb-go-live-origin-heading">
                Allowed website origin
              </OnboardingSectionHeading>
              <p className="onboarding-go-live-card-description">
                Your AI Agent will only run on approved websites. Use the exact website origin where the widget will
                be installed.
              </p>
            </header>

            <div className="onboarding-go-live-card-body">
              <FieldRow
                label="Website origin"
                htmlFor="onb-go-live-origin"
                required
                helperText="Use only the origin, not a full page URL. For example, use https://example.com instead of https://example.com/pricing."
                error={originFieldError}
              >
                <Input
                  id="onb-go-live-origin"
                  quiet
                  value={origin}
                  onChange={(e) => {
                    setOrigin(e.target.value);
                    if (originFieldError) setOriginFieldError(null);
                    if (apiError) setApiError(null);
                    clearStepAttempt(STEP);
                  }}
                  placeholder="https://example.com"
                  disabled={lifecycleBusy}
                  autoComplete="url"
                  invalid={Boolean(originFieldError)}
                />
              </FieldRow>

              <OriginLabelField value={label} onChange={setLabel} disabled={lifecycleBusy} />

              <aside className="instruction-helper-card" aria-label="Website origin examples">
                <button
                  type="button"
                  className="instruction-helper-toggle"
                  aria-expanded={examplesOpen}
                  aria-controls="onb-go-live-examples-panel"
                  onClick={() => setExamplesOpen((open) => !open)}
                  disabled={lifecycleBusy}
                >
                  <OnboardingSectionHeading
                    icon={Lightbulb}
                    iconVariant="tip"
                    as="span"
                    titleClassName={styles.helperCardTitle}
                  >
                    Examples
                  </OnboardingSectionHeading>
                  <ChevronDown
                    className={cn(
                      'instruction-helper-toggle-icon size-4 shrink-0 text-[var(--color-text-muted)]',
                      examplesOpen && 'is-open',
                    )}
                    aria-hidden
                  />
                </button>
                <div
                  id="onb-go-live-examples-panel"
                  className={cn('instruction-helper-panel-wrap', examplesOpen && 'is-open')}
                  aria-hidden={!examplesOpen}
                >
                  <div className="instruction-helper-panel-inner">
                    <div className="instruction-helper-panel">
                      <OriginExamplesContent />
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {apiError ? <GoLiveApiAlert message={apiError} /> : null}
        </div>
      </OnboardingStepPanel>

      <GoLiveConfirmModal
        open={confirmOpen}
        onClose={() => {
          if (!confirmingGoLive) setConfirmOpen(false);
        }}
        onConfirm={confirmGoLive}
        confirming={confirmingGoLive}
        action="publish"
        itemVariant="onboarding"
        whatHappensNext={whatHappensNext}
        description="This publishes your agent and opens installation options on your dashboard."
      />

      <BotLifecycleModal
        open={goLiveFlowActive && !dashboardNavigationPinned}
        runKey={lifecycleRunKey}
        action="publish"
        botId={null}
        publishRunner={publishRunner}
        navigateToDashboardAfterPublish
        onBusyChange={setLifecycleBusy}
        onClose={() => void onLifecycleClose()}
        onSuccess={onLifecycleSuccess}
        openingDashboard={routingToDashboard}
      />
    </>
  );
}

