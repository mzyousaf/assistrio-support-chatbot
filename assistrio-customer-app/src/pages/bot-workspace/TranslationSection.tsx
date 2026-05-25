import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Globe2, Loader2, Save } from 'lucide-react';
import { patchCustomerBot } from '../../api/customerApi';
import { Button, Card, CardBody, SearchableSelect } from '@/components/ui';
import { BotSettingsFieldset } from '@/components/bot-workspace/BotSettingsFieldset';
import { Modal } from '@/components/ui/Modal';
import { useBotWorkspace } from './BotWorkspaceContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import { ws } from './workspace';
import { cn } from '@/lib/utils';
import {
  toastPlaygroundSectionSaveFailed,
  toastPlaygroundSectionSaved,
  toastPlaygroundValidationWarning,
} from '@/lib/playgroundSectionSaveToasts';
import {
  buildTranslationPatchPayload,
  normalizeTranslationState,
  shouldShowFixedLanguageControl,
  type TranslationMode,
} from './translationSettings';

/** Matches `AgentWorkspaceSidebar` Playground label (`playground/translation`). */
const TRANSLATION_SECTION_NAV_LABEL = 'Translation';

const LANGUAGE_OPTIONS = [
  'English', 'Arabic', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Chinese',
  'Japanese', 'Korean', 'Hindi', 'Urdu', 'Turkish', 'Dutch',
].map((label) => ({ value: label, label }));

const MODE_OPTIONS: Array<{ value: TranslationMode; label: string; helper: string }> = [
  { value: 'english_only', label: 'English only', helper: 'Always reply in English.' },
  { value: 'auto', label: 'Auto customer language', helper: 'Reply in the language your customer uses.' },
  { value: 'fixed', label: 'Fixed language', helper: 'Always reply in one selected language.' },
];

export function TranslationSection() {
  const { bot, botId, softReload, canManageBot } = useBotWorkspace();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<TranslationMode>('english_only');
  const [fixedLanguage, setFixedLanguage] = useState('English');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const hydrate = useCallback(() => {
    if (!bot) return;
    const state = normalizeTranslationState(bot.translationSettings);
    setEnabled(state.enabled);
    setMode(state.mode);
    setFixedLanguage(state.fixedLanguage);
    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    return registerManualSaveGuard('translation', () => dirty, hydrate);
  }, [dirty, hydrate]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError(null);
  }, []);

  const payload = useMemo(
    () => buildTranslationPatchPayload({ enabled, mode, fixedLanguage }),
    [enabled, mode, fixedLanguage],
  );
  const effectiveMode: TranslationMode = enabled ? mode : 'english_only';

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!botId || saving || !dirty) return;
      if (enabled && mode === 'fixed' && !fixedLanguage.trim()) {
        setSaveError('Please select a fixed language.');
        toastPlaygroundValidationWarning(
          'Fixed language required',
          'Choose which language the assistant should always reply in.',
        );
        return;
      }
      setSaving(true);
      setSaveError(null);
      const res = await patchCustomerBot(botId, payload);
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        toastPlaygroundSectionSaveFailed('translation', res.error);
        return;
      }
      toastPlaygroundSectionSaved('translation');
      setDirty(false);
      await softReload();
    },
    [botId, dirty, payload, saving, softReload],
  );

  if (!bot || !botId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-translation-editor>
      <form className="flex min-h-0 w-full flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className={ws.workspaceEditorH1}>Translation</h1>
                  {enabled ? (
                    <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                      Enabled
                    </span>
                  ) : null}
                </div>
                <p className={ws.workspaceEditorLead}>
                  Let your assistant understand customers in any language while keeping your team transcript in English.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[var(--color-teal-700)] underline underline-offset-2 hover:text-[var(--color-teal-800)]"
                onClick={() => setHowItWorksOpen(true)}
                aria-label="Open how translation works"
              >
                How this works
              </Button>
              {canManageBot ? (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!dirty || saving}
                className={cn(ws.workspaceEditorButtonLabel, 'h-9 gap-1.5 px-4 shadow-sm')}
                aria-busy={saving || undefined}
                aria-label={
                  saving ? `Saving ${TRANSLATION_SECTION_NAV_LABEL}` : `Save ${TRANSLATION_SECTION_NAV_LABEL}`
                }
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save {TRANSLATION_SECTION_NAV_LABEL}
                  </>
                )}
              </Button>
              ) : null}
            </div>
          </header>

          {saveError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div> : null}

          <BotSettingsFieldset canManage={canManageBot}>
          <div className={ws.workspaceEditorCardGap}>
            <Card className="overflow-hidden rounded-2xl border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7fffd_100%)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <CardBody className="p-6 sm:p-7">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">Speak every customer&apos;s language</h2>
                    <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-600">
                      Reply in the right language for every visitor, while your team keeps a clear English transcript.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant={enabled ? 'danger' : 'primary'}
                        size="sm"
                        className="min-w-[5.5rem]"
                        aria-label={enabled ? 'Disable' : 'Enable'}
                        disabled={saving}
                        onClick={() => {
                          const nextEnabled = !enabled;
                          setEnabled(nextEnabled);
                          if (nextEnabled && mode === 'english_only') setMode('auto');
                          markDirty();
                        }}
                      >
                        {enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>

                  <div className="relative mx-auto flex h-44 w-full max-w-[22rem] items-center justify-center overflow-hidden rounded-2xl border border-teal-100/70 bg-white/80">
                    <div className="absolute inset-x-8 inset-y-10 rounded-full bg-gradient-to-r from-teal-50 via-white to-rose-50" aria-hidden />
                    <div className="relative z-[2] flex items-center justify-center text-teal-600">
                      <Globe2 size={44} strokeWidth={1.75} aria-hidden />
                      <span className="sr-only">Language globe</span>
                    </div>
                    {[
                      { label: 'Hello', left: '14%', top: '18%' },
                      { label: 'Bonjour', left: '34%', top: '9%' },
                      { label: 'مرحبا', left: '70%', top: '11%' },
                      { label: '你好', left: '86%', top: '34%' },
                      { label: 'Ciao', left: '23%', top: '78%' },
                      { label: 'Hola', left: '74%', top: '80%' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="absolute z-[1]"
                        style={{ left: item.left, top: item.top, transform: 'translate(-50%, -50%)' }}
                      >
                        <span
                          className="pointer-events-none absolute left-1/2 top-1/2 h-px w-12 origin-left bg-slate-200/90"
                          style={{
                            transform: 'translateY(-50%) rotate(15deg)',
                          }}
                          aria-hidden
                        />
                        <span className="relative z-[2] inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="rounded-2xl">
              <CardBody className="space-y-4 p-6 sm:p-7">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Reply language</h3>
                  <p className="mt-1 text-sm text-slate-600">Choose how your assistant replies to visitors.</p>
                </div>

                <div role="radiogroup" aria-label="Translation mode" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {MODE_OPTIONS.map((item) => {
                    const selected = effectiveMode === item.value;
                    const lockedByDisabled = !enabled && item.value !== 'english_only';
                    return (
                      <button
                        key={item.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-pressed={selected}
                        disabled={saving || lockedByDisabled}
                        className={cn(
                          'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                          selected
                            ? 'border-teal-300 bg-teal-50/70 ring-1 ring-teal-200'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                          lockedByDisabled && 'cursor-not-allowed opacity-65',
                        )}
                        onClick={() => {
                          if (!enabled && item.value !== 'english_only') return;
                          setMode(item.value);
                          markDirty();
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{item.label}</span>
                          <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full border text-[11px] font-semibold', selected ? 'border-teal-300 bg-teal-100 text-teal-700' : 'border-slate-300 text-slate-500')}>
                            {selected ? <Check size={12} /> : ''}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{item.helper}</p>
                      </button>
                    );
                  })}
                </div>

                {shouldShowFixedLanguageControl(enabled, mode) ? (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-800" htmlFor="translation-fixed-language">
                      Language
                    </label>
                    <p className="text-xs text-slate-500">The assistant will always reply in this language.</p>
                    <SearchableSelect
                      id="translation-fixed-language"
                      value={fixedLanguage}
                      options={LANGUAGE_OPTIONS}
                      disabled={saving}
                      onChange={(e) => {
                        setFixedLanguage(e.target.value);
                        markDirty();
                      }}
                      searchPlaceholder="Search language..."
                      quiet
                    />
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card className="rounded-2xl border-teal-100/80 bg-white">
              <CardBody className="space-y-4 p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">English transcript for voice messages</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Voice message transcripts are always stored in English, even when visitors and the assistant speak in another language.
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-700">
                    Always English
                  </span>
                </div>
              </CardBody>
            </Card>

          </div>
          </BotSettingsFieldset>
        </div>
      </form>

      <Modal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        title="How this works"
        description="Translation changes what visitors see, while your internal conversation record stays in English."
        closeOnBackdropClick
      >
        <div className="grid grid-cols-1 gap-3">
          {[
            [
              '1',
              'Choose a reply mode',
              'Select how assistant replies are shown: English only, automatic visitor language detection, or one fixed language.',
            ],
            [
              '2',
              'Visitors get replies in that mode',
              'During chat, the assistant follows your selected setting for visitor-facing responses on every message.',
            ],
            [
              '3',
              'Voice message transcript stays in English',
              'In workspace conversation history and review screens, voice message transcripts are stored and shown in English.',
            ],
          ].map(([num, title, body]) => (
            <div key={num} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-50 px-1.5 text-[11px] font-semibold text-teal-700">
                {num}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
