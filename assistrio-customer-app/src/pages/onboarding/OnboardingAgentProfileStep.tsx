import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { prevStepPath } from '../../onboarding/onboardingState';

import { styles } from './onboardingStep';
import { Button, Input, Textarea } from '@/components/ui';

const STEP = 'agent-profile';

export function OnboardingAgentProfileStep() {
  const { bot, patchDraft, markStepDone, goToNextAfter } = useOnboardingFlow();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bot) return;
    setName(String(bot.name ?? ''));
    const cats = Array.isArray(bot.categories) ? bot.categories : [];
    setCategory(cats[0] ? String(cats[0]) : String(bot.category ?? ''));
    setShortDescription(String(bot.shortDescription ?? ''));
  }, [bot?.id, bot]);

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    const c = category.trim();
    const sd = shortDescription.trim();
    if (!n) {
      setError('Agent name is required.');
      return;
    }
    if (!c) {
      setError('Category or use case is required.');
      return;
    }
    if (!sd) {
      setError('Short description is required.');
      return;
    }
    setSaving(true);
    const res = await patchDraft({
      name: n,
      categories: [c],
      shortDescription: sd,
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
      <h2 className={styles.h2}>Agent profile</h2>
      <p className={styles.p}>Basic details visitors see first.</p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <label className={styles.label} htmlFor="onb-profile-name">
        Agent name *
      </label>
      <Input id="onb-profile-name" quiet value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      <label className={styles.label} htmlFor="onb-profile-category">
        Category / use case *
      </label>
      <Input
        id="onb-profile-category"
        quiet
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="e.g. Customer support, Sales, Internal HR"
      />
      <label className={styles.label} htmlFor="onb-profile-short-desc">
        Short description *
      </label>
      <Textarea
        id="onb-profile-short-desc"
        quiet
        rows={3}
        value={shortDescription}
        onChange={(e) => setShortDescription(e.target.value)}
        placeholder="One or two sentences about what this assistant does."
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
          {saving ? 'Saving…' : 'Save & continue'}
        </Button>
      </div>
    </form>
  );
}
