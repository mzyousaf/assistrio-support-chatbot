import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  createAdminPlatformBot,
  getAdminBot,
  patchAdminBot,
  postAdminKnowledgeFaq,
} from '@/api/adminApi';
import type { PlatformBotType } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataPageLayout } from '@/layout/workspace-layout';
import { BOT_FIELD_MAX, clampStr } from '@/lib/botFieldLimits';
import { cn } from '@/lib/utils';
import {
  BEHAVIOR_PRESETS,
  TONE_OPTIONS,
  VALID_TONE_VALUES,
} from '@/pages/bot-workspace/behaviorConstants';
import {
  ADMIN_PLATFORM_BOT_ONBOARDING_STEPS,
  clearAdminPlatformBotOnboardingSession,
  maxReachableStepIndex,
  onboardingStyles as styles,
  readAdminPlatformBotOnboardingSession,
  stepIndex,
  writeAdminPlatformBotOnboardingSession,
  type AdminPlatformBotOnboardingStepId,
} from './adminPlatformBotOnboarding';

const LENGTHS = [
  { value: 'short', label: 'Short & direct' },
  { value: 'medium', label: 'Balanced' },
  { value: 'long', label: 'Detailed' },
] as const;

export function AdminBotNewPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<AdminPlatformBotOnboardingStepId>('platform');
  const [botId, setBotId] = useState<string | null>(null);
  const [stepsCompleted, setStepsCompleted] = useState<AdminPlatformBotOnboardingStepId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sess = readAdminPlatformBotOnboardingSession();
    if (sess) {
      setBotId(sess.botId);
      setStepsCompleted(sess.stepsCompleted);
      const maxI = maxReachableStepIndex(sess.stepsCompleted);
      const next =
        maxI < ADMIN_PLATFORM_BOT_ONBOARDING_STEPS.length - 1
          ? ADMIN_PLATFORM_BOT_ONBOARDING_STEPS[Math.min(maxI + 1, maxI)].id
          : ADMIN_PLATFORM_BOT_ONBOARDING_STEPS[maxI].id;
      setStep(next);
    }
  }, []);

  const persistSession = useCallback(
    (id: string, completed: AdminPlatformBotOnboardingStepId[]) => {
      writeAdminPlatformBotOnboardingSession({ botId: id, stepsCompleted: completed });
    },
    [],
  );

  const markDone = useCallback(
    (stepId: AdminPlatformBotOnboardingStepId) => {
      setStepsCompleted((prev) => {
        const next = prev.includes(stepId) ? prev : [...prev, stepId];
        if (botId) persistSession(botId, next);
        return next;
      });
    },
    [botId, persistSession],
  );

  const goNext = useCallback((current: AdminPlatformBotOnboardingStepId) => {
    const i = stepIndex(current);
    if (i < 0 || i >= ADMIN_PLATFORM_BOT_ONBOARDING_STEPS.length - 1) return;
    setStep(ADMIN_PLATFORM_BOT_ONBOARDING_STEPS[i + 1].id);
    setError(null);
  }, []);

  const goBack = useCallback((current: AdminPlatformBotOnboardingStepId) => {
    const i = stepIndex(current);
    if (i <= 0) return;
    setStep(ADMIN_PLATFORM_BOT_ONBOARDING_STEPS[i - 1].id);
    setError(null);
  }, []);

  const curI = stepIndex(step);
  const maxI = maxReachableStepIndex(stepsCompleted);
  const progress = ((curI + 1) / ADMIN_PLATFORM_BOT_ONBOARDING_STEPS.length) * 100;

  const stepNav = useMemo(
    () => (
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Creation steps">
        {ADMIN_PLATFORM_BOT_ONBOARDING_STEPS.map((s, i) => {
          const reachable = i <= maxReachableStepIndex(stepsCompleted) || (i === 0 && !botId);
          const active = s.id === step;
          const baseClass =
            'flex items-center gap-2 rounded-lg px-3 py-2 text-[0.875rem] font-medium transition-colors duration-100';
          if (reachable || (i === 0 && step === 'platform')) {
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={cn(
                    baseClass,
                    'cursor-pointer border-none bg-transparent',
                    active
                      ? 'bg-[color-mix(in_srgb,var(--teal-600)_8%,transparent)] text-primary font-semibold'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                  )}
                  onClick={() => {
                    if (i <= maxReachableStepIndex(stepsCompleted) || (i === 0 && !botId)) {
                      setStep(s.id);
                    }
                  }}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold',
                      active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          }
          return (
            <li key={s.id}>
              <span className={cn(baseClass, 'text-slate-300 cursor-default')}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.6875rem] font-bold text-slate-300">
                  {i + 1}
                </span>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    ),
    [step, stepsCompleted, botId, maxI],
  );

  return (
    <DataPageLayout
      embedded
      title="Create bot"
      description="Same step-by-step flow as customer bot onboarding — profile, behavior, optional knowledge, then deploy."
    >
      <p className="mb-6">
        <Link
          to="/admin-bots"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate-600 no-underline hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to admin bots
        </Link>
      </p>

      <Card className="mx-auto max-w-[52rem]">
        <CardHeader>
          <CardTitle>Platform bot onboarding</CardTitle>
          <p className="m-0 mt-1 text-[0.875rem] text-slate-500">
            Save each step before continuing. You can go back anytime.
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[0.8125rem] text-slate-400">
            Step {curI + 1} of {ADMIN_PLATFORM_BOT_ONBOARDING_STEPS.length}
          </p>
        </CardHeader>
        <CardBody className="flex flex-col gap-6">
          {stepNav}
          {step === 'platform' ? (
            <PlatformStep
              botId={botId}
              error={error}
              saving={saving}
              onError={setError}
              onSaving={setSaving}
              onCreated={(id) => {
                setBotId(id);
                persistSession(id, []);
              }}
              onDone={() => {
                markDone('platform');
                goNext('platform');
              }}
            />
          ) : null}
          {step === 'profile' && botId ? (
            <ProfileStep
              botId={botId}
              error={error}
              saving={saving}
              onError={setError}
              onSaving={setSaving}
              onBack={() => goBack('profile')}
              onDone={() => {
                markDone('profile');
                goNext('profile');
              }}
            />
          ) : null}
          {step === 'behavior' && botId ? (
            <BehaviorStep
              botId={botId}
              error={error}
              saving={saving}
              onError={setError}
              onSaving={setSaving}
              onBack={() => goBack('behavior')}
              onDone={() => {
                markDone('behavior');
                goNext('behavior');
              }}
            />
          ) : null}
          {step === 'knowledge' && botId ? (
            <KnowledgeStep
              botId={botId}
              error={error}
              saving={saving}
              onError={setError}
              onSaving={setSaving}
              onBack={() => goBack('knowledge')}
              onSkip={() => {
                markDone('knowledge');
                goNext('knowledge');
              }}
              onDone={() => {
                markDone('knowledge');
                goNext('knowledge');
              }}
            />
          ) : null}
          {step === 'deploy' && botId ? (
            <DeployStep
              botId={botId}
              error={error}
              saving={saving}
              onError={setError}
              onSaving={setSaving}
              onBack={() => goBack('deploy')}
              onFinish={() => {
                clearAdminPlatformBotOnboardingSession();
                navigate(`/bots/${botId}/deploy`, { replace: true });
              }}
            />
          ) : null}
          {step !== 'platform' && !botId ? (
            <p className="text-sm text-slate-500">Complete the platform bot step first.</p>
          ) : null}
        </CardBody>
      </Card>
    </DataPageLayout>
  );
}

function PlatformStep({
  botId,
  error,
  saving,
  onError,
  onSaving,
  onCreated,
  onDone,
}: {
  botId: string | null;
  error: string | null;
  saving: boolean;
  onError: (m: string | null) => void;
  onSaving: (v: boolean) => void;
  onCreated: (id: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platformBotType, setPlatformBotType] = useState<PlatformBotType>('landing_demo');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (botId) {
      onDone();
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      onError('Bot name is required.');
      return;
    }
    onError(null);
    onSaving(true);
    const res = await createAdminPlatformBot({
      name: trimmed,
      description: description.trim() || undefined,
      platformBotType,
      visibility,
    });
    onSaving(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onCreated(res.data._id);
    onDone();
  }

  return (
    <form className={styles.step} onSubmit={(e) => void onSubmit(e)}>
      <h2 className={styles.h2}>Platform bot</h2>
      <p className={styles.p}>Name and visibility for an Assistrio-owned bot in the platform workspace.</p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <div>
        <Label htmlFor="platform-bot-name">Bot name *</Label>
        <Input
          id="platform-bot-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving || !!botId}
          required
        />
      </div>
      <div>
        <Label htmlFor="platform-bot-description">Description</Label>
        <Textarea
          id="platform-bot-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving || !!botId}
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="platform-bot-type">Type</Label>
        <Select
          id="platform-bot-type"
          value={platformBotType}
          onChange={(e) => setPlatformBotType(e.target.value as PlatformBotType)}
          disabled={saving || !!botId}
        >
          <option value="landing_demo">Landing demo</option>
          <option value="showcase">Showcase</option>
          <option value="support">Support</option>
          <option value="internal">Internal</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="platform-bot-visibility">Visibility</Label>
        <Select
          id="platform-bot-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value === 'private' ? 'private' : 'public')}
          disabled={saving || !!botId}
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </Select>
      </div>
      <div className={styles.actions}>
        <span />
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Creating…' : botId ? 'Continue' : 'Create & continue'}
        </Button>
      </div>
    </form>
  );
}

function ProfileStep({
  botId,
  error,
  saving,
  onError,
  onSaving,
  onBack,
  onDone,
}: {
  botId: string;
  error: string | null;
  saving: boolean;
  onError: (m: string | null) => void;
  onSaving: (v: boolean) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [shortDescription, setShortDescription] = useState('');

  useEffect(() => {
    void getAdminBot(botId).then((res) => {
      if (!res.ok) return;
      const b = res.data.bot;
      setName(clampStr(String(b.name ?? ''), BOT_FIELD_MAX.name));
      const cats = Array.isArray(b.categories) ? b.categories : [];
      setCategory(
        clampStr(cats[0] ? String(cats[0]) : String(b.category ?? ''), BOT_FIELD_MAX.categoryText),
      );
      setShortDescription(clampStr(String(b.shortDescription ?? ''), BOT_FIELD_MAX.shortDescription));
    });
  }, [botId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const c = category.trim();
    const sd = shortDescription.trim();
    if (!n || !c || !sd) {
      onError('Name, category, and short description are required.');
      return;
    }
    onError(null);
    onSaving(true);
    const res = await patchAdminBot(botId, {
      name: n,
      categories: [c],
      shortDescription: sd,
    });
    onSaving(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onDone();
  }

  return (
    <form className={styles.step} onSubmit={(e) => void onSubmit(e)}>
      <h2 className={styles.h2}>Bot profile</h2>
      <p className={styles.p}>Basic details visitors see first.</p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <div>
        <Label htmlFor="onb-profile-name">Bot name *</Label>
        <Input id="onb-profile-name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      </div>
      <div>
        <Label htmlFor="onb-profile-category">Category or use case *</Label>
        <Input
          id="onb-profile-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={saving}
        />
      </div>
      <div>
        <Label htmlFor="onb-profile-short">Short description *</Label>
        <Textarea
          id="onb-profile-short"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          disabled={saving}
          rows={3}
        />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.back} onClick={onBack}>
          Back
        </button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save & continue'}
        </Button>
      </div>
    </form>
  );
}

function BehaviorStep({
  botId,
  error,
  saving,
  onError,
  onSaving,
  onBack,
  onDone,
}: {
  botId: string;
  error: string | null;
  saving: boolean;
  onError: (m: string | null) => void;
  onSaving: (v: boolean) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState('friendly');
  const [behaviorPreset, setBehaviorPreset] = useState('default');
  const [responseLength, setResponseLength] = useState('medium');

  useEffect(() => {
    void getAdminBot(botId).then((res) => {
      if (!res.ok) return;
      const b = res.data.bot;
      setDescription(String(b.description ?? ''));
      const p = (b.personality as Record<string, unknown> | undefined) ?? {};
      const t = String(p.tone ?? 'friendly');
      setTone(VALID_TONE_VALUES.has(t) ? t : 'friendly');
      const pr = String(p.behaviorPreset ?? 'default');
      setBehaviorPreset(BEHAVIOR_PRESETS.some((x) => x.value === pr) ? pr : 'default');
      const cfg = (b.config as Record<string, unknown> | undefined) ?? {};
      const rl = String(cfg.responseLength ?? 'medium');
      setResponseLength(LENGTHS.some((x) => x.value === rl) ? rl : 'medium');
    });
  }, [botId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = description.trim();
    if (!d) {
      onError('Instructions / assistant description is required.');
      return;
    }
    onError(null);
    onSaving(true);
    const rl = LENGTHS.some((x) => x.value === responseLength) ? responseLength : 'medium';
    const res = await patchAdminBot(botId, {
      description: d,
      personality: { tone, behaviorPreset },
      config: { responseLength: rl },
    });
    onSaving(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onDone();
  }

  return (
    <form className={styles.step} onSubmit={(e) => void onSubmit(e)}>
      <h2 className={styles.h2}>Behavior</h2>
      <p className={styles.p}>Tone, preset, and instructions that shape replies.</p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <div>
        <Label htmlFor="onb-behavior-desc">Instructions *</Label>
        <Textarea
          id="onb-behavior-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
          rows={5}
        />
      </div>
      <div>
        <Label htmlFor="onb-behavior-tone">Tone</Label>
        <Select id="onb-behavior-tone" value={tone} onChange={(e) => setTone(e.target.value)} disabled={saving}>
          {TONE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="onb-behavior-preset">Preset</Label>
        <Select
          id="onb-behavior-preset"
          value={behaviorPreset}
          onChange={(e) => setBehaviorPreset(e.target.value)}
          disabled={saving}
        >
          {BEHAVIOR_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="onb-behavior-length">Response length</Label>
        <Select
          id="onb-behavior-length"
          value={responseLength}
          onChange={(e) => setResponseLength(e.target.value)}
          disabled={saving}
        >
          {LENGTHS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.back} onClick={onBack}>
          Back
        </button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save & continue'}
        </Button>
      </div>
    </form>
  );
}

function KnowledgeStep({
  botId,
  error,
  saving,
  onError,
  onSaving,
  onBack,
  onSkip,
  onDone,
}: {
  botId: string;
  error: string | null;
  saving: boolean;
  onError: (m: string | null) => void;
  onSaving: (v: boolean) => void;
  onBack: () => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    const a = answer.trim();
    if (!q && !a) {
      onSkip();
      return;
    }
    if (!q || !a) {
      onError('Both question and answer are required, or skip this step.');
      return;
    }
    onError(null);
    onSaving(true);
    const res = await postAdminKnowledgeFaq(botId, { question: q, answer: a });
    onSaving(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onDone();
  }

  return (
    <form className={styles.step} onSubmit={(e) => void onSubmit(e)}>
      <h2 className={styles.h2}>Knowledge (optional)</h2>
      <p className={styles.p}>Add a starter FAQ or skip and add more from the bot knowledge workspace.</p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <div>
        <Label htmlFor="onb-faq-q">Question</Label>
        <Input id="onb-faq-q" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={saving} />
      </div>
      <div>
        <Label htmlFor="onb-faq-a">Answer</Label>
        <Textarea id="onb-faq-a" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={saving} rows={4} />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.back} onClick={onBack}>
          Back
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={onSkip}>
            Skip
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add FAQ & continue'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function DeployStep({
  botId,
  error,
  saving,
  onError,
  onSaving,
  onBack,
  onFinish,
}: {
  botId: string;
  error: string | null;
  saving: boolean;
  onError: (m: string | null) => void;
  onSaving: (v: boolean) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [origin, setOrigin] = useState('');
  const [label, setLabel] = useState('');
  const [saveOrigin, setSaveOrigin] = useState(true);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saveOrigin && origin.trim()) {
      onError(null);
      onSaving(true);
      const res = await patchAdminBot(botId, {
        allowedOrigins: [
          {
            origin: origin.trim(),
            ...(label.trim() ? { label: label.trim() } : {}),
            isActive: true,
          },
        ],
      });
      onSaving(false);
      if (!res.ok) {
        onError(res.error);
        return;
      }
    }
    onFinish();
  }

  return (
    <form className={styles.step} onSubmit={(e) => void onSubmit(e)}>
      <h2 className={styles.h2}>Deploy</h2>
      <p className={styles.p}>
        Optionally save an allowed origin, then open the full deploy workspace to publish and embed the widget.
      </p>
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-[0.875rem] text-slate-600">
        <Checkbox checked={saveOrigin} onChange={(e) => setSaveOrigin(e.target.checked)} />
        Save allowed origin now
      </label>
      <div>
        <Label htmlFor="onb-deploy-origin">Allowed origin</Label>
        <Input
          id="onb-deploy-origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="https://yourdomain.com"
          disabled={saving || !saveOrigin}
        />
      </div>
      <div>
        <Label htmlFor="onb-deploy-label">Label (optional)</Label>
        <Input
          id="onb-deploy-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={saving || !saveOrigin}
        />
      </div>
      <p className="text-[0.8125rem] text-slate-500">
        Publishing and embed keys are configured on the{' '}
        <Link to={`/bots/${botId}/deploy`} className="font-medium text-primary no-underline hover:underline">
          Deploy
        </Link>{' '}
        page.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.back} onClick={onBack}>
          Back
        </button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Open deploy workspace'}
        </Button>
      </div>
    </form>
  );
}
