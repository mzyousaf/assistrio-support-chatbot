import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { prevStepPath } from '../../onboarding/onboardingState';

import { styles } from './onboardingStep';
import { Button, Checkbox, Input } from '@/components/ui';

const STEP = 'go-live';

export function OnboardingGoLiveStep() {
  const { bot, completeWizard } = useOnboardingFlow();
  const [origin, setOrigin] = useState('');
  const [label, setLabel] = useState('');
  const [publish, setPublish] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bot) return;
    const ao = Array.isArray(bot.allowedOrigins) ? bot.allowedOrigins : [];
    const first = ao.find((o) => String(o.origin ?? '').trim());
    if (first) {
      setOrigin(String(first.origin));
      setLabel(typeof first.label === 'string' ? first.label : '');
    }
  }, [bot?.id, bot]);

  async function onFinish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (publish) {
      const o = origin.trim();
      if (!o) {
        setError('Website URL (allowed origin) is required to publish.');
        return;
      }
    }
    setSaving(true);
    const res = await completeWizard({
      publish,
      origin,
      label,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
    }
  }

  const back = prevStepPath(STEP);

  return (
    <form className={styles.step} onSubmit={(e) => void onFinish(e)}>
      <h2 className={styles.h2}>Go live</h2>
      <p className={styles.p}>
        To publish, add the exact site origin where the widget will run (for example{' '}
        <code className={styles.code}>https://www.example.com</code>). You can finish without
        publishing and return from the Agents page anytime.
      </p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <label className={styles.check}>
        <Checkbox checked={publish} onChange={(e) => setPublish(e.target.checked)} />
        Publish this assistant now (finalize draft)
      </label>
      <label className={styles.label} htmlFor="onb-go-live-origin">
        Allowed origin {publish ? '*' : '(optional, saved only if you publish)'}
      </label>
      <Input
        id="onb-go-live-origin"
        quiet
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        placeholder="https://yourdomain.com"
        disabled={!publish}
      />
      <label className={styles.label} htmlFor="onb-go-live-label">
        Label (optional)
      </label>
      <Input
        id="onb-go-live-label"
        quiet
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Marketing site"
        disabled={!publish}
      />
      <div className={styles.actions}>
        {back ? (
          <Link to={`/onboarding/${back}`} className={styles.back}>
            Back
          </Link>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Finishing…' : publish ? 'Publish & finish' : 'Finish setup'}
        </Button>
      </div>
    </form>
  );
}
