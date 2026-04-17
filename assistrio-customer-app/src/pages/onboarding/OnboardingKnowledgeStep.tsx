import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { prevStepPath } from '../../onboarding/onboardingState';

import { styles } from './onboardingStep';
import { Button, Input, Textarea } from '@/components/ui';

const dangerLinkBtn =
  'h-auto min-h-0 px-0 py-0 text-[0.8125rem] font-normal text-[var(--color-danger-text-emphasis)] underline hover:bg-transparent';

const STEP = 'knowledge-base';

type FaqRow = { question: string; answer: string };

export function OnboardingKnowledgeStep() {
  const { bot, patchDraft, markStepDone, goToNextAfter } = useOnboardingFlow();
  const [snippet, setSnippet] = useState('');
  const [faqs, setFaqs] = useState<FaqRow[]>([{ question: '', answer: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bot) return;
    setSnippet(String(bot.knowledgeDescription ?? ''));
    const raw = Array.isArray(bot.faqs) ? bot.faqs : [];
    const rows: FaqRow[] = raw
      .map((f) => ({
        question: String(f.question ?? ''),
        answer: String(f.answer ?? ''),
      }))
      .filter((f) => f.question || f.answer);
    setFaqs(rows.length ? rows : [{ question: '', answer: '' }]);
  }, [bot?.id, bot]);

  function addFaq() {
    setFaqs((prev) => [...prev, { question: '', answer: '' }]);
  }

  function removeFaq(i: number) {
    setFaqs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const sn = snippet.trim();
    const cleanedFaqs = faqs
      .map((f) => ({
        question: f.question.trim(),
        answer: f.answer.trim(),
        active: true as const,
      }))
      .filter((f) => f.question && f.answer);
    if (!sn && cleanedFaqs.length === 0) {
      setError('Add a text snippet and/or at least one FAQ with both question and answer.');
      return;
    }
    setSaving(true);
    const res = await patchDraft({
      knowledgeDescription: sn,
      faqs: cleanedFaqs,
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
      <h2 className={styles.h2}>Knowledge base</h2>
      <p className={styles.p}>
        Free-form notes and Q&amp;A pairs are embedded with your assistant. File uploads can be added
        later from the assistant workspace.
      </p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <label className={styles.label} htmlFor="onb-kb-snippet">
        Text snippet (optional if you add FAQs below)
      </label>
      <Textarea
        id="onb-kb-snippet"
        quiet
        rows={4}
        value={snippet}
        onChange={(e) => setSnippet(e.target.value)}
        placeholder="Facts, policies, product notes, or anything the assistant should know."
      />
      <div className={styles.faqBlock}>
        <div className={styles.faqHead}>
          <span className={styles.faqTitle}>FAQ / Q&amp;A</span>
          <Button type="button" variant="secondary" size="sm" onClick={addFaq}>
            Add pair
          </Button>
        </div>
        {faqs.map((row, i) => (
          <div key={i} className={styles.faqRow}>
            <label className={styles.label} htmlFor={`onb-kb-q-${i}`}>
              Question
            </label>
            <Input
              id={`onb-kb-q-${i}`}
              quiet
              value={row.question}
              onChange={(e) =>
                setFaqs((prev) =>
                  prev.map((r, j) => (j === i ? { ...r, question: e.target.value } : r)),
                )
              }
            />
            <label className={styles.label} htmlFor={`onb-kb-a-${i}`}>
              Answer
            </label>
            <Textarea
              id={`onb-kb-a-${i}`}
              quiet
              rows={2}
              value={row.answer}
              onChange={(e) =>
                setFaqs((prev) =>
                  prev.map((r, j) => (j === i ? { ...r, answer: e.target.value } : r)),
                )
              }
            />
            {faqs.length > 1 ? (
              <Button type="button" variant="ghost" className={dangerLinkBtn} onClick={() => removeFaq(i)}>
                Remove
              </Button>
            ) : null}
          </div>
        ))}
      </div>
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
