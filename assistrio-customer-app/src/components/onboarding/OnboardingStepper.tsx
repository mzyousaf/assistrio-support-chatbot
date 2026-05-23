import { useCallback, type MouseEvent, type ReactNode } from 'react';
import { Check, Info, Loader2, Lock, AlertCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { hasOnboardingStepDirty } from '@/onboarding/onboardingStepGuard';
import { useOnboardingLeaveStep } from '@/onboarding/OnboardingLeaveStepModal';
import { Tooltip } from '@/components/ui';
import type { WorkspaceOnboardingResponse } from '@/api/types';
import type { OnboardingStepPath } from '@/onboarding/onboardingState';
import { isOnboardingStepDataComplete } from '@/onboarding/onboardingStepValidation';
import type { OnboardingStepPrimaryAction } from '@/onboarding/OnboardingStepActionsContext';
import { OnboardingStepPrimaryButton } from './OnboardingStepPrimaryButton';
import type { OnboardingStepDisplay } from './onboardingStepper.constants';

const ERROR_STEP_TOOLTIP = 'Needs attention — fix the issues below to continue.';

export type OnboardingStepVisualState =
  | 'completed'
  | 'active'
  | 'pending'
  | 'error'
  | 'unvisited'
  | 'locked'
  | 'loading';

function resolveStepState(
  index: number,
  stepId: OnboardingStepPath,
  currentStepId: string,
  completedStepIds: string[],
  maxReachableIndex: number,
  attemptedStepIds: ReadonlySet<OnboardingStepPath>,
  savingStepId: OnboardingStepPath | null,
  onboarding: WorkspaceOnboardingResponse | null,
): OnboardingStepVisualState {
  if (savingStepId === stepId && stepId === currentStepId) return 'loading';

  // Stepper error when revisiting a previously completed step after a failed Continue/save.
  // First-visit failures stay pending/teal (errors show in the form only).
  const wasCompleted = completedStepIds.includes(stepId);
  const revisitedWithError = wasCompleted && attemptedStepIds.has(stepId);

  if (stepId === currentStepId) {
    if (revisitedWithError) return 'error';
    if (!isOnboardingStepDataComplete(stepId, onboarding)) return 'pending';
    return 'active';
  }

  if (wasCompleted) {
    if (revisitedWithError) return 'error';
    return 'completed';
  }

  if (index > maxReachableIndex) return 'locked';
  return 'unvisited';
}

function stepAriaLabel(step: OnboardingStepDisplay, state: OnboardingStepVisualState): string {
  switch (state) {
    case 'completed':
      return `${step.title}, completed`;
    case 'active':
      return `${step.title}, current step, ready to continue`;
    case 'pending':
      return `${step.title}, current step, incomplete`;
    case 'error':
      return `${step.title}, needs attention`;
    case 'loading':
      return `${step.title}, saving`;
    case 'locked':
      return `${step.title}, locked`;
    case 'unvisited':
      return `${step.title}, not started`;
    default:
      return step.title;
  }
}

type ConnectorTone = 'completed' | 'current' | 'error' | 'muted';

function connectorToneForStep(state: OnboardingStepVisualState, index: number, currentIndex: number): ConnectorTone {
  if (state === 'error') return 'error';
  if (state === 'completed') return 'completed';
  if (index < currentIndex) return 'completed';
  if (index === currentIndex) return 'current';
  return 'muted';
}

function showCurrentStepPulse(state: OnboardingStepVisualState): boolean {
  return state === 'pending' || state === 'active';
}

function showErrorStepPulse(state: OnboardingStepVisualState): boolean {
  return state === 'error';
}

type StepIndicatorProps = {
  index: number;
  state: OnboardingStepVisualState;
  isLast: boolean;
  connectorTone: ConnectorTone;
  compact?: boolean;
};

function StepIndicator({
  index,
  state,
  isLast,
  connectorTone,
  compact = false,
}: StepIndicatorProps) {
  const circleClass = cn(
    'onboarding-step-indicator relative z-[1] flex shrink-0 items-center justify-center rounded-full font-semibold',
    compact ? 'size-5 text-[0.5625rem]' : 'size-6 text-[0.6875rem]',
    state === 'completed' && 'bg-emerald-600 text-white',
    (state === 'active' || state === 'pending' || state === 'loading') && 'bg-[var(--color-teal-600)] text-white',
    state === 'error' && 'bg-[var(--color-danger-text-emphasis)] text-white',
    state === 'unvisited' &&
      'bg-white text-[var(--color-teal-700)] ring-1 ring-[color-mix(in_oklab,var(--color-teal-300)_55%,white)]',
    state === 'locked' &&
      'bg-white text-[var(--color-teal-600)]/75 ring-1 ring-[color-mix(in_oklab,var(--color-teal-200)_65%,white)]',
  );

  let icon: ReactNode = index + 1;
  if (state === 'completed') {
    icon = <Check className={compact ? 'size-2.5 stroke-[2.75]' : 'size-3 stroke-[2.75]'} aria-hidden />;
  } else if (state === 'error') {
    icon = <AlertCircle className={compact ? 'size-2.5 stroke-[2]' : 'size-3 stroke-[2]'} aria-hidden />;
  } else if (state === 'locked') {
    icon = <Lock className={compact ? 'size-2.5 stroke-[2]' : 'size-2.5 stroke-[2]'} aria-hidden />;
  } else if (state === 'loading') {
    icon = <Loader2 className={cn(compact ? 'size-2.5' : 'size-3', 'animate-spin')} aria-hidden />;
  }

  const connectorClass = cn(
    'onboarding-step-connector flex-1',
    compact && 'onboarding-step-connector--compact',
    compact ? 'min-h-[1.25rem]' : 'min-h-[2.5rem]',
    connectorTone === 'completed' && 'bg-emerald-400/85',
    connectorTone === 'current' && 'bg-[color-mix(in_oklab,var(--color-teal-600)_35%,white)]',
    connectorTone === 'error' && 'onboarding-step-connector--error',
    connectorTone === 'muted' && 'bg-slate-200/90',
  );

  const indicatorBubble = (
    <span className={circleClass} data-state={state} aria-hidden={state !== 'error' ? true : undefined}>
      {icon}
    </span>
  );

  const pulseWave = showErrorStepPulse(state) ? (
    <span className="onboarding-step-pulse-wave onboarding-step-pulse-wave--error" aria-hidden />
  ) : showCurrentStepPulse(state) ? (
    <span className="onboarding-step-pulse-wave onboarding-step-pulse-wave--current" aria-hidden />
  ) : null;

  const wrappedIndicator =
    pulseWave !== null ? (
      <span
        className={cn(
          'onboarding-step-indicator-wrap relative flex shrink-0 items-center justify-center overflow-visible',
          compact ? 'size-5' : 'size-6',
          showErrorStepPulse(state) && 'onboarding-step-indicator-wrap--error',
          showCurrentStepPulse(state) && 'onboarding-step-indicator-wrap--current',
        )}
      >
        {pulseWave}
        {indicatorBubble}
      </span>
    ) : (
      indicatorBubble
    );

  const indicatorNode =
    state === 'error' ? (
      <Tooltip content={ERROR_STEP_TOOLTIP} side="right" panelClassName="max-w-[14rem]">
        <span
          className="inline-flex shrink-0 overflow-visible rounded-full"
          role="img"
          aria-label={ERROR_STEP_TOOLTIP}
          tabIndex={0}
        >
          {wrappedIndicator}
        </span>
      </Tooltip>
    ) : (
      wrappedIndicator
    );

  return (
    <div className="flex flex-col items-center self-stretch">
      {indicatorNode}
      {!isLast ? (
        <span className={connectorClass} data-tone={connectorTone} aria-hidden />
      ) : null}
    </div>
  );
}

function stepTextTone(state: OnboardingStepVisualState) {
  if (state === 'completed') {
    return {
      title: 'font-semibold text-emerald-800',
      subtitle: 'text-emerald-600/90',
      info: 'text-emerald-600',
      description: 'text-emerald-900/70',
    };
  }
  if (state === 'error') {
    return {
      title: 'font-semibold text-[var(--color-teal-800)]',
      subtitle: 'text-[var(--color-teal-600)]',
      info: 'text-[var(--color-teal-600)]',
      description: 'text-[var(--color-teal-900)]/75',
    };
  }
  if (state === 'active' || state === 'pending' || state === 'loading') {
    return {
      title: 'font-semibold text-[var(--color-teal-800)]',
      subtitle: 'text-[var(--color-teal-600)]',
      info: 'text-[var(--color-teal-600)]',
      description: 'text-[var(--color-teal-900)]/75',
    };
  }
  if (state === 'unvisited') {
    return {
      title: 'font-medium text-[var(--color-teal-800)]/90',
      subtitle: 'text-[var(--color-teal-600)]/85',
      info: 'text-[var(--color-teal-600)]/80',
      description: 'text-[var(--color-teal-900)]/70',
    };
  }
  if (state === 'locked') {
    return {
      title: 'font-medium text-[var(--color-teal-800)]/80',
      subtitle: 'text-[var(--color-teal-600)]/70',
      info: 'text-[var(--color-teal-600)]/65',
      description: 'text-[var(--color-teal-900)]/60',
    };
  }
  return {
    title: 'font-medium text-[var(--color-teal-800)]/90',
    subtitle: 'text-[var(--color-teal-600)]/85',
    info: 'text-[var(--color-teal-600)]/80',
    description: 'text-[var(--color-teal-900)]/70',
  };
}

type OnboardingStepperItemProps = {
  step: OnboardingStepDisplay;
  index: number;
  state: OnboardingStepVisualState;
  isLast: boolean;
  connectorTone: ConnectorTone;
  currentStepId: string;
  href?: string;
  compact?: boolean;
  stepActions?: OnboardingStepPrimaryAction | null;
  onStepLinkClick?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};

function OnboardingStepperItem({
  step,
  index,
  state,
  isLast,
  connectorTone,
  currentStepId,
  href,
  compact = false,
  stepActions = null,
  onStepLinkClick,
}: OnboardingStepperItemProps) {
  const isInteractive = Boolean(href) && state !== 'locked';
  const isOpen = step.id === currentStepId;
  const ariaLabel = stepAriaLabel(step, state);
  const tone = stepTextTone(state);

  const content = (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col',
        !compact && !isLast && (isOpen ? 'pb-5' : 'pb-3.5'),
      )}
    >
      <div className="min-w-0 flex-1">
        <div className={cn('flex min-w-0 items-start gap-1.5', !isOpen && 'pr-0.5')}>
          <div className="min-w-0 flex-1">
            <div className={cn('onboarding-stepper-title transition-colors duration-300 ease-out', tone.title)}>{step.title}</div>
            {!compact ? (
              <div className={cn('onboarding-stepper-subtitle mt-0.5 transition-colors duration-300 ease-out', tone.subtitle)}>{step.subtitle}</div>
            ) : null}
          </div>
          {!compact && !isOpen ? (
            <Tooltip content={step.description} side="top">
              <button
                type="button"
                className={cn(
                  'mt-px flex size-4 shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal-600)]',
                  tone.info,
                )}
                aria-label={`More about ${step.title}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="size-3.5 stroke-[1.75]" aria-hidden />
              </button>
            </Tooltip>
          ) : null}
        </div>
        {!compact ? (
          <div
            className={cn('onboarding-stepper-detail-wrap', isOpen && 'is-open')}
            aria-hidden={!isOpen}
          >
            <div className="onboarding-stepper-detail-inner">
              <p className={cn('onboarding-stepper-description m-0 mt-1.5', tone.description)}>
                {step.description}
              </p>
              {isOpen && stepActions ? <OnboardingStepPrimaryButton {...stepActions} /> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const row = (
    <div className={cn('flex gap-2.5', compact ? 'items-center py-1' : 'items-start pt-0.5')}>
      <StepIndicator
        index={index}
        state={state}
        isLast={isLast}
        connectorTone={connectorTone}
        compact={compact}
      />
      {!compact ? content : null}
    </div>
  );

  if (isInteractive && href && !isOpen) {
    return (
      <li className="onboarding-stepper-item list-none">
        <NavLink
          to={href}
          className="block no-underline transition-opacity duration-200 ease-out hover:opacity-90"
          aria-label={ariaLabel}
          onClick={(event) => onStepLinkClick?.(event, href)}
        >
          {row}
        </NavLink>
      </li>
    );
  }

  return (
    <li
      className={cn('onboarding-stepper-item list-none transition-[padding] duration-300 ease-out', isOpen && 'is-open')}
      aria-current={isOpen ? 'step' : undefined}
      aria-label={ariaLabel}
    >
      {row}
    </li>
  );
}

function compactPillClass(state: OnboardingStepVisualState): string {
  return cn(
    'onboarding-step-indicator inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-300 ease-out',
    state === 'completed' && 'bg-emerald-600 text-white',
    (state === 'active' || state === 'pending' || state === 'loading') &&
      'bg-[var(--color-teal-600)] text-white',
    state === 'error' && 'bg-[var(--color-danger-text-emphasis)] text-white',
    state === 'unvisited' &&
      'bg-white text-[var(--color-teal-700)] ring-1 ring-[color-mix(in_oklab,var(--color-teal-300)_55%,white)]',
    state === 'locked' &&
      'bg-white text-[var(--color-teal-600)]/80 ring-1 ring-[color-mix(in_oklab,var(--color-teal-200)_70%,white)]',
  );
}

export type OnboardingStepperProps = {
  steps: readonly OnboardingStepDisplay[];
  currentStepId: string;
  completedStepIds: string[];
  maxReachableIndex: number;
  attemptedStepIds?: ReadonlySet<OnboardingStepPath>;
  savingStepId?: OnboardingStepPath | null;
  onboarding?: WorkspaceOnboardingResponse | null;
  getStepHref?: (stepId: string, index: number) => string | undefined;
  compact?: boolean;
  className?: string;
  stepActions?: OnboardingStepPrimaryAction | null;
};

export function OnboardingStepper({
  steps,
  currentStepId,
  completedStepIds,
  maxReachableIndex,
  attemptedStepIds = new Set(),
  savingStepId = null,
  onboarding = null,
  getStepHref,
  compact = false,
  className,
  stepActions = null,
}: OnboardingStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const { requestLeaveTo } = useOnboardingLeaveStep();

  const guardStepLink = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!hasOnboardingStepDirty()) return;
      event.preventDefault();
      void requestLeaveTo(href);
    },
    [requestLeaveTo],
  );

  if (compact) {
    return (
      <nav aria-label="Onboarding progress" className={cn('w-full', className)}>
        <ol className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((step, index) => {
            const state = resolveStepState(
              index,
              step.id,
              currentStepId,
              completedStepIds,
              maxReachableIndex,
              attemptedStepIds,
              savingStepId,
              onboarding,
            );
            const href = getStepHref?.(step.id, index);
            const reachable = state !== 'locked';
            const isOpen = step.id === currentStepId;
            const ariaLabel = stepAriaLabel(step, state);

            let leading: ReactNode = (
              <span className="inline-flex size-3.5 items-center justify-center text-[0.625rem] font-semibold">
                {index + 1}
              </span>
            );
            if (state === 'completed') {
              leading = <Check className="size-3 stroke-[2.75]" aria-hidden />;
            } else if (state === 'error') {
              leading = <AlertCircle className="size-3 stroke-[2]" aria-hidden />;
            } else if (state === 'locked') {
              leading = <Lock className="size-2.5 stroke-[2]" aria-hidden />;
            } else if (state === 'loading') {
              leading = <Loader2 className="size-3 animate-spin" aria-hidden />;
            }

            const pillInner = (
              <span
                className={cn(
                  compactPillClass(state),
                  (showErrorStepPulse(state) || showCurrentStepPulse(state)) &&
                    'onboarding-step-indicator-wrap relative overflow-visible',
                  showErrorStepPulse(state) && 'onboarding-step-indicator-wrap--error',
                  showCurrentStepPulse(state) && 'onboarding-step-indicator-wrap--current',
                )}
                data-state={state}
              >
                {showErrorStepPulse(state) ? (
                  <span
                    className="onboarding-step-pulse-wave onboarding-step-pulse-wave--error onboarding-step-pulse-wave--compact"
                    aria-hidden
                  />
                ) : showCurrentStepPulse(state) ? (
                  <span
                    className="onboarding-step-pulse-wave onboarding-step-pulse-wave--current onboarding-step-pulse-wave--compact"
                    aria-hidden
                  />
                ) : null}
                {leading}
                <span className="relative z-[1] max-w-[5rem] truncate">{step.title}</span>
              </span>
            );

            const pill =
              state === 'error' ? (
                <Tooltip content={ERROR_STEP_TOOLTIP} side="bottom" panelClassName="max-w-[14rem]">
                  <span className="inline-flex cursor-help" role="img" aria-label={ERROR_STEP_TOOLTIP} tabIndex={0}>
                    {pillInner}
                  </span>
                </Tooltip>
              ) : (
                pillInner
              );

            return (
              <li key={step.id} className="shrink-0">
                {reachable && href ? (
                  <NavLink
                    to={href}
                    className="no-underline"
                    aria-current={isOpen ? 'step' : undefined}
                    aria-label={ariaLabel}
                    onClick={(event) => guardStepLink(event, href)}
                  >
                    {pill}
                  </NavLink>
                ) : (
                  <div aria-disabled="true" aria-label={ariaLabel}>
                    {pill}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {(() => {
          const active = steps.find((s) => s.id === currentStepId);
          if (!active) return null;
          return (
            <div key={currentStepId} className="onboarding-stepper-compact-detail">
              <p className="onboarding-stepper-description m-0 mt-2 text-[var(--color-teal-900)]/75">
                {active.description}
              </p>
              {stepActions ? <OnboardingStepPrimaryButton {...stepActions} className="mt-2" /> : null}
            </div>
          );
        })()}
      </nav>
    );
  }

  return (
    <nav aria-label="Onboarding steps" className={cn('w-full', className)}>
      <ol className="m-0 flex list-none flex-col gap-0 p-0">
        {steps.map((step, index) => {
          const state = resolveStepState(
            index,
            step.id,
            currentStepId,
            completedStepIds,
            maxReachableIndex,
            attemptedStepIds,
            savingStepId,
            onboarding,
          );
          const href = state !== 'locked' ? getStepHref?.(step.id, index) : undefined;
          const connectorTone = connectorToneForStep(state, index, currentIndex);

          return (
            <OnboardingStepperItem
              key={step.id}
              step={step}
              index={index}
              state={state}
              isLast={index === steps.length - 1}
              connectorTone={connectorTone}
              currentStepId={currentStepId}
              href={href}
              stepActions={stepActions}
              onStepLinkClick={guardStepLink}
            />
          );
        })}
      </ol>
    </nav>
  );
}
