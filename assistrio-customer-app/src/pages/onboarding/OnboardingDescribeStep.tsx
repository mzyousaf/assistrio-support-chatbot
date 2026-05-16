import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { prevStepPath } from '../../onboarding/onboardingState';

import { styles } from './onboardingStep';
import { Button, Select, Textarea } from '@/components/ui';
import { BEHAVIOR_PRESETS, TONE_OPTIONS, VALID_TONE_VALUES } from '../bot-workspace/behaviorConstants';

const STEP = 'describe-profile';

const LENGTHS = [
  { value: 'short', label: 'Short & direct' },
  { value: 'medium', label: 'Balanced' },
  { value: 'long', label: 'Detailed' },
] as const;

export function OnboardingDescribeStep() {
  const { bot, patchDraft, markStepDone, goToNextAfter } = useOnboardingFlow();
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState<string>('friendly');
  const [behaviorPreset, setBehaviorPreset] = useState<string>('default');
  const [responseLength, setResponseLength] = useState<string>('medium');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bot) return;
    setDescription(String(bot.description ?? ''));
    const p = (bot.personality as Record<string, unknown> | undefined) ?? {};
    const t = String(p.tone ?? 'friendly');
    setTone(VALID_TONE_VALUES.has(t) ? t : 'friendly');
    const pr = String(p.behaviorPreset ?? 'default');
    setBehaviorPreset(BEHAVIOR_PRESETS.some((x) => x.value === pr) ? pr : 'default');
    const cfg = (bot.config as Record<string, unknown> | undefined) ?? {};
    const rl = String(cfg.responseLength ?? 'medium');
    setResponseLength(LENGTHS.some((x) => x.value === rl) ? rl : 'medium');
  }, [bot?.id, bot]);

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const d = description.trim();
    if (!d) {
      setError('Instructions / assistant description is required.');
      return;
    }
    setSaving(true);
    const res = await patchDraft({
      description: d,
      personality: {
        tone,
        behaviorPreset,
      },
      config: {
        responseLength,
      },
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    markStepDone(STEP);
    goToNextAfter(STEP);
  }

  const back = prevStepPath(STEP);

  return (
    <form className={styles.step} onSubmit={(e) => void onContinue(e)}>
      <h2 className={styles.h2}>Describe your assistant</h2>
      <p className={styles.p}>How it should sound and behave in conversations.</p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <label className={styles.label} htmlFor="onb-describe-body">
        Instructions & assistant description *
      </label>
      <Textarea
        id="onb-describe-body"
        quiet
        rows={5}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What should the assistant do, prioritize, or avoid? This guides answers."
      />
      <label className={styles.label} htmlFor="onb-describe-tone">
        Tone *
      </label>
      <Select id="onb-describe-tone" quiet value={tone} onChange={(e) => setTone(e.target.value)}>
        {TONE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <label className={styles.label} htmlFor="onb-describe-preset">
        Style preset
      </label>
      <Select id="onb-describe-preset" quiet value={behaviorPreset} onChange={(e) => setBehaviorPreset(e.target.value)}>
        {BEHAVIOR_PRESETS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <label className={styles.label} htmlFor="onb-describe-length">
        Response length *
      </label>
      <Select id="onb-describe-length" quiet value={responseLength} onChange={(e) => setResponseLength(e.target.value)}>
        {LENGTHS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <div className={styles.actions}>
        {back ? (
          <Link to={`/onboarding/${back}`} className={styles.back}>
            Back
          </Link>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save & continue'}
        </Button>
      </div>
    </form>
  );
}
