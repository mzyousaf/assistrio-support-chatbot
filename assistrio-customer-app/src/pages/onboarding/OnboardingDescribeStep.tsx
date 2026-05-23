import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, Lightbulb, Loader2, Mic, Square } from 'lucide-react';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { useOnboardingStepUi } from '../../onboarding/OnboardingStepUiContext';
import { useRegisterOnboardingStepActions } from '../../onboarding/OnboardingStepActionsContext';
import { isDescribeStepDirty } from '../../onboarding/onboardingStepDirty';
import { useRegisterOnboardingStepGuard } from '../../onboarding/useRegisterOnboardingStepGuard';
import {
  getAgentInstructionsFromDraft,
  MIN_AGENT_INSTRUCTIONS_LENGTH,
} from '../../onboarding/agentInstructions';
import { useDescribeAgentRecorder } from '@/hooks/useDescribeAgentRecorder';

import { styles } from './onboardingStep';
import { Button } from '@/components/ui';
import { OnboardingStepPanel } from '@/components/onboarding/OnboardingStepPanel';
import { OnboardingSectionHeading } from '@/components/onboarding/OnboardingSectionHeading';
import { validateAgentInstructionsText } from '@/components/agent/AgentInstructionsTextarea';
import { BEHAVIOR_PRESETS, VALID_TONE_VALUES } from '../bot-workspace/behaviorConstants';
import { responseLengthToMaxTokens } from '../bot-workspace/aiIntegrationsConstants';
import { BOT_FIELD_MAX, clampStr } from '@/lib/botFieldLimits';
import { appToast } from '@/lib/app-toast';
import {
  toastOnboardingStepSaved,
  toastOnboardingStepSaveFailed,
} from '@/lib/onboardingActionToasts';
import { cn } from '@/lib/utils';

const STEP = 'describe-profile';

const ONBOARDING_DICTATION_API_ERROR = 'Invalid or empty audio recording. Please try again.';

const RESPONSE_LENGTHS = new Set(['short', 'medium', 'long']);

const INSTRUCTION_EXAMPLES = [
  'Help customers understand pricing, plans, and billing questions.',
  'Guide users through setup, troubleshooting, and common product workflows.',
  'Answer policy questions clearly and escalate when human support is needed.',
];

const EXAMPLE_INSTRUCTION =
  'Help customers understand pricing, product features, refunds, and support options. Be friendly, clear, and avoid making promises we cannot guarantee.';

function formatRecordingTimer(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatComposerCharCount(charCount: number, max: number, min: number): string {
  const base = `${charCount.toLocaleString()} / ${max.toLocaleString()}`;
  if (charCount >= min) return base;
  return `${base} · ${(min - charCount).toLocaleString()} to go`;
}

function hiddenBehaviorDefaults(instructions: {
  tone?: string;
  behaviorPreset?: string;
  responseLength?: string;
}) {
  const toneRaw = String(instructions.tone ?? 'friendly');
  const tone = VALID_TONE_VALUES.has(toneRaw) ? toneRaw : 'friendly';
  const presetRaw = String(instructions.behaviorPreset ?? 'default');
  const behaviorPreset = BEHAVIOR_PRESETS.some((x) => x.value === presetRaw) ? presetRaw : 'default';
  const rlRaw = String(instructions.responseLength ?? 'medium');
  const responseLength = RESPONSE_LENGTHS.has(rlRaw) ? rlRaw : 'medium';
  return { tone, behaviorPreset, responseLength };
}

export function OnboardingDescribeStep() {
  const { onboarding, patchInstructions, transcribeDescribeAgent, markStepDone, goToNextAfter } =
    useOnboardingFlow();
  const { markStepAttemptFailed, clearStepAttempt, setSavingStepId } = useOnboardingStepUi();
  const instructions = onboarding?.draft.instructions;
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const {
    state: recorderState,
    error: recorderError,
    elapsedSec,
    start,
    stop,
    cancel,
    setError: setRecorderError,
  } = useDescribeAgentRecorder();

  useEffect(() => {
    if (!instructions) return;
    setText(getAgentInstructionsFromDraft({ instructions }));
    setFieldError(null);
    setError(null);
    setDictationError(null);
  }, [onboarding?.workspaceId, instructions]);

  const hydrateFromDraft = useCallback(() => {
    setText(getAgentInstructionsFromDraft({ instructions }));
    setFieldError(null);
    setError(null);
    setDictationError(null);
  }, [instructions]);

  const persistInstructions = useCallback(async (): Promise<boolean> => {
    setError(null);
    const validationError = validateAgentInstructionsText(text);
    if (validationError) {
      setFieldError(validationError);
      return false;
    }
    setFieldError(null);

    const { tone, behaviorPreset, responseLength } = hiddenBehaviorDefaults(instructions ?? {});
    const clamped = clampStr(text.trim(), BOT_FIELD_MAX.personalityDescription);

    const res = await patchInstructions({
      description: clamped,
      systemPrompt: clamped,
      tone,
      behaviorPreset,
      responseLength,
      maxTokens: responseLengthToMaxTokens(responseLength),
    });
    if (!res.ok) {
      setError(res.error);
      toastOnboardingStepSaveFailed('describe-profile', res.error);
      return false;
    }
    return true;
  }, [instructions, patchInstructions, text]);

  useRegisterOnboardingStepGuard({
    isDirty: () => isDescribeStepDirty({ text, instructions }),
    discard: hydrateFromDraft,
    save: persistInstructions,
  });

  async function appendTranscriptFromFile(file: File) {
    setDictationError(null);
    setDictating(true);
    const res = await transcribeDescribeAgent(file);
    setDictating(false);
    if (!res.ok) {
      appToast.error(ONBOARDING_DICTATION_API_ERROR);
      return;
    }
    const transcript = (res.text ?? '').trim();
    if (!transcript) {
      setDictationError('No speech detected. Try again with a clearer recording.');
      return;
    }
    const append = text.trim() ? `${text.trim()}\n\n${transcript}` : transcript;
    setText(clampStr(append, BOT_FIELD_MAX.personalityDescription));
    if (fieldError) setFieldError(null);
  }

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    clearStepAttempt(STEP);
    setSaving(true);
    setSavingStepId(STEP);
    try {
      const saved = await persistInstructions();
      if (!saved) {
        markStepAttemptFailed(STEP);
        return;
      }
      await markStepDone(STEP);
      toastOnboardingStepSaved('describe-profile');
      goToNextAfter(STEP);
    } finally {
      setSaving(false);
      setSavingStepId(null);
    }
  }

  async function onStartRecording() {
    if (recorderState === 'requesting') return;

    setDictationError(null);
    setRecorderError(null);
    const res = await start();
    if (!res.ok) {
      setDictationError(res.error);
    }
  }

  async function onStopRecording() {
    const file = await stop();
    if (!file?.size) {
      setDictationError('Recording was empty. Try again.');
      return;
    }
    await appendTranscriptFromFile(file);
  }

  function onCancelRecording() {
    cancel();
    setDictationError(null);
  }

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const recording = recorderState === 'recording';
  const requestingMic = recorderState === 'requesting';
  const processingAudio = dictating || requestingMic;
  const locked = saving || processingAudio || recording;
  const displayDictationError = dictationError ?? recorderError;
  const charCount = text.trim().length;
  const underMin = charCount > 0 && charCount < MIN_AGENT_INSTRUCTIONS_LENGTH;

  useRegisterOnboardingStepActions({
    primaryLabel: saving ? 'Saving…' : 'Continue',
    primaryLoading: saving,
    primaryDisabled: locked,
  });

  return (
    <OnboardingStepPanel
      stepId={STEP}
      headerClassName="describe-agent-header"
      eyebrow="Behavior setup"
      title="Describe Your AI Agent"
      description="Tell your agent how it should speak, what it should help with, and when it should escalate."
      formProps={{ onSubmit: (e) => void onContinue(e) }}
    >
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}

      <div className="onboarding-main-stack">
        <aside className="instruction-helper-card" aria-label="Instruction examples">
          <button
            type="button"
            className="instruction-helper-toggle"
            aria-expanded={inspirationOpen}
            aria-controls="onb-inspiration-panel"
            onClick={() => setInspirationOpen((open) => !open)}
          >
            <OnboardingSectionHeading
              icon={Lightbulb}
              iconVariant="tip"
              as="span"
              titleClassName={styles.helperCardTitle}
            >
              Need inspiration?
            </OnboardingSectionHeading>
            <ChevronDown
              className={cn(
                'instruction-helper-toggle-icon size-4 shrink-0 text-[var(--color-text-muted)]',
                inspirationOpen && 'is-open',
              )}
              aria-hidden
            />
          </button>
          <div
            id="onb-inspiration-panel"
            className={cn('instruction-helper-panel-wrap', inspirationOpen && 'is-open')}
            aria-hidden={!inspirationOpen}
          >
            <div className="instruction-helper-panel-inner">
              <div className="instruction-helper-panel">
                <p className={styles.helperCardText}>
                  Strong instructions mention what the agent should help with, how it should sound, and when to
                  escalate.
                </p>
                <ul className={styles.helperCardList}>
                  {INSTRUCTION_EXAMPLES.map((example) => (
                    <li key={example} className="relative pl-3 before:absolute before:left-0 before:content-['•']">
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </aside>

        <section
          className="instruction-composer"
          data-ui-input-wrapper=""
          data-invalid={fieldError ? 'true' : undefined}
          data-disabled={locked ? 'true' : undefined}
          aria-labelledby="onb-agent-instructions-label"
        >
          <div className="instruction-composer-header">
            <div className="instruction-composer-label-row">
              <label id="onb-agent-instructions-label" className="instruction-composer-label" htmlFor="onb-agent-instructions">
                Agent instructions
              </label>
              <span
                className={cn('instruction-composer-char-count', underMin && 'is-under-min')}
                aria-live="polite"
              >
                {formatComposerCharCount(
                  charCount,
                  BOT_FIELD_MAX.personalityDescription,
                  MIN_AGENT_INSTRUCTIONS_LENGTH,
                )}
              </span>
            </div>
            <p className="instruction-composer-label-hint">
              Be specific about tone, responsibilities, limits, and escalation rules.
            </p>
          </div>

          <div className="instruction-composer-body">
            <textarea
              id="onb-agent-instructions"
              className="instruction-composer-textarea"
              rows={10}
              value={text}
              disabled={locked}
              maxLength={BOT_FIELD_MAX.personalityDescription}
              placeholder={EXAMPLE_INSTRUCTION}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'onb-agent-instructions-hint' : undefined}
              onChange={(e) => {
                setText(e.target.value.slice(0, BOT_FIELD_MAX.personalityDescription));
                if (fieldError) {
                  setFieldError(null);
                  clearStepAttempt(STEP);
                }
              }}
            />
            {!recording && !processingAudio ? (
              <div className="instruction-composer-float-actions">
                <button
                  type="button"
                  className="instruction-composer-record-btn"
                  disabled={saving}
                  aria-label="Record instructions"
                  onClick={() => void onStartRecording()}
                >
                  <Mic className="instruction-composer-record-btn-icon" aria-hidden />
                  <span className="instruction-composer-record-btn-label">Record instructions</span>
                </button>
              </div>
            ) : null}
          </div>

          {fieldError ? (
            <p
              id="onb-agent-instructions-hint"
              className="instruction-composer-footer-hint is-error"
              role="alert"
            >
              {fieldError}
            </p>
          ) : null}

          {recording ? (
            <div className="recording-bar is-recording" role="status" aria-live="polite">
              <div className="recording-indicator">
                <span className="recording-pulse-dot" aria-hidden />
                <Mic className="size-4" aria-hidden />
                <span>Recording…</span>
                <span className="recording-timer">{formatRecordingTimer(elapsedSec)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="primary" size="sm" onClick={() => void onStopRecording()}>
                  <Square className="size-3.5 fill-current" aria-hidden />
                  Stop
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onCancelRecording}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : processingAudio ? (
            <div className="recording-bar is-processing" role="status" aria-live="polite">
              <div className="recording-indicator">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span>{requestingMic ? 'Requesting microphone…' : 'Transcribing audio…'}</span>
              </div>
            </div>
          ) : null}

          {displayDictationError ? (
            <div className="instruction-composer-alert" role="alert">
              <AlertCircle className="size-4" aria-hidden />
              <span>{displayDictationError}</span>
            </div>
          ) : null}
        </section>
      </div>
    </OnboardingStepPanel>
  );
}
