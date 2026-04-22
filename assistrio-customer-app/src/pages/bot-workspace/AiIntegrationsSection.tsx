import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Lock, RefreshCw, Save } from 'lucide-react';
import { patchCustomerBot } from '../../api/customerApi';
import type { CustomerBotDetail } from '../../api/types';
import { Button, Card, CardBody, FieldRow, Range, SearchableSelect, Switch, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useBotWorkspace } from './BotWorkspaceContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import {
  clampCreativity,
  CREATIVITY_MARKER_LABELS,
  CREATIVITY_MARKER_VALUES,
  LENGTH_MARKER_LABELS,
  LENGTH_MARKER_TOKENS,
  languageForPayload,
  maxTokensToResponseLength,
  MAX_TOKENS_MAX,
  MAX_TOKENS_MIN,
  MAX_TOKENS_STEP,
  CREATIVITY_TOOLTIP_LINES,
  normalizeLanguageSelectValue,
  RESPONSE_LANGUAGE_OPTIONS,
  RESPONSE_LENGTH_TOOLTIP_LINES,
  snapMaxTokens,
} from './aiIntegrationsConstants';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ws } from './workspace';

const PAGE_TITLE = 'AI & Responses';
const SECTION_NAV_LABEL = 'AI & Responses';

function rangeDetailTooltip(lines: readonly string[]) {
  return (
    <span className="flex flex-col gap-1.5">
      {lines.map((line, i) => (
        <span key={i} className="block leading-snug">
          {line}
        </span>
      ))}
    </span>
  );
}

function formatLastTrainedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return null;
  }
}

const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';

/**
 * Server replaces the whole `personality` subdocument on PATCH. Re-hydrate all fields
 * `normalizePersonalityInput` persists so Behavior data is not cleared when only
 * `language` changes.
 */
function buildPersonalityPatchForAi(bot: CustomerBotDetail, languageSelect: string): Record<string, unknown> {
  const p = bot.personality;
  const out: Record<string, unknown> = {};
  if (typeof p?.name === 'string' && p.name.trim()) out.name = p.name.trim();
  if (typeof p?.description === 'string' && p.description.trim()) out.description = p.description.trim();
  if (typeof p?.systemPrompt === 'string' && p.systemPrompt.trim()) out.systemPrompt = p.systemPrompt.trim();
  if (typeof p?.behaviorPreset === 'string' && p.behaviorPreset.trim()) out.behaviorPreset = p.behaviorPreset.trim();
  if (typeof p?.tone === 'string' && p.tone) out.tone = p.tone;
  if (typeof p?.thingsToAvoid === 'string' && p.thingsToAvoid.trim()) out.thingsToAvoid = p.thingsToAvoid.trim();
  out.language = languageForPayload(languageSelect).trim();
  return out;
}

export function AiIntegrationsSection() {
  const responseLangId = useId();
  const creativityId = useId();
  const lengthId = useId();
  const { bot, botId, softReload } = useBotWorkspace();

  const [language, setLanguage] = useState('auto');
  const [creativity, setCreativity] = useState(0.5);
  const [maxTokens, setMaxTokens] = useState(512);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrateFromBot = useCallback(() => {
    if (!bot) return;
    const p = bot.personality;
    const c = bot.config ?? {};

    setLanguage(normalizeLanguageSelectValue(p?.language));

    const rawT = c.temperature;
    const t =
      typeof rawT === 'number' && Number.isFinite(rawT) ? clampCreativity(rawT) : 0.3;
    setCreativity(t);

    const rawM = c.maxTokens;
    const m =
      typeof rawM === 'number' && Number.isFinite(rawM)
        ? snapMaxTokens(rawM)
        : snapMaxTokens(512);
    setMaxTokens(m);

    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    hydrateFromBot();
  }, [hydrateFromBot]);

  useEffect(() => {
    return registerManualSaveGuard('ai-integrations', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError(null);
  }, []);

  const languageOptions = useMemo(() => {
    if (language.startsWith('__custom:')) {
      const code = language.slice('__custom:'.length);
      return [...RESPONSE_LANGUAGE_OPTIONS, { value: language, label: `Other (${code})` }];
    }
    return RESPONSE_LANGUAGE_OPTIONS;
  }, [language]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!bot || !botId || saving || !dirty) return;
      setSaving(true);
      setSaveError(null);

      const mt = snapMaxTokens(maxTokens);
      const res = await patchCustomerBot(botId, {
        personality: buildPersonalityPatchForAi(bot, language),
        config: {
          temperature: clampCreativity(creativity),
          maxTokens: mt,
          responseLength: maxTokensToResponseLength(mt),
        },
      });
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setDirty(false);
      await softReload();
    },
    [bot, botId, creativity, dirty, language, maxTokens, softReload, saving],
  );

  if (!bot || !botId) return null;

  const lastTrainedRaw = bot.lastTrainedAt;
  const lastTrainedIso = typeof lastTrainedRaw === 'string' ? lastTrainedRaw : null;
  const lastTrainedLine = formatLastTrainedAt(lastTrainedIso);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-ai-responses-editor>
      <form
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => void onSubmit(e)}
        aria-label="AI and response settings"
      >
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>{PAGE_TITLE}</h1>
                <p className={ws.workspaceEditorLead}>
                  Choose response language and fine-tune how the assistant answers.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col sm:pt-0">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!dirty || saving}
                className={cn(
                  ws.workspaceEditorButtonLabel,
                  'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[9.5rem]',
                )}
                aria-busy={saving || undefined}
                aria-label={saving ? 'Saving response settings' : `Save ${SECTION_NAV_LABEL}`}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save response settings
                  </>
                )}
              </Button>
            </div>
          </header>

          {saveError ? (
            <div
              className={cn(
                ws.workspaceEditorBannerText,
                'mb-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[var(--color-danger-text-emphasis)]',
              )}
            >
              {saveError}
            </div>
          ) : null}

          <div className={ws.workspaceEditorCardGap}>
            <Card className={cardClass}>
              <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                <section className={ws.workspaceEditorCardSection} aria-labelledby="ai-response-language">
                  <WorkspaceSectionHeader
                    id="ai-response-language"
                    title="Response language"
                    description="Choose a fixed response language, or let the assistant reply in the visitor’s language."
                  />
                  <div className="mt-4">
                    <FieldRow label="Language" htmlFor={responseLangId}>
                      <SearchableSelect
                        id={responseLangId}
                        value={language}
                        options={languageOptions}
                        onChange={(e) => {
                          setLanguage(e.target.value);
                          markDirty();
                        }}
                        searchPlaceholder="Search languages…"
                        quiet
                        className="w-full max-w-md"
                      />
                    </FieldRow>
                  </div>
                </section>
              </CardBody>
            </Card>

            <Card className={cardClass}>
              <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                <section className={ws.workspaceEditorCardSection} aria-labelledby="ai-response-style">
                  <WorkspaceSectionHeader
                    id="ai-response-style"
                    title="Response style"
                    description="Adjust creativity and how much detail the assistant uses in replies."
                  />

                  <div className={cn('mt-4', ws.workspaceEditorFieldPairGrid)}>
                    <div className="min-w-0">
                      <Range
                        id={creativityId}
                        label="Creativity"
                        labelTooltip={rangeDetailTooltip(CREATIVITY_TOOLTIP_LINES)}
                        hint="Lower values keep answers more consistent. Higher values allow more variation."
                        min={0}
                        max={1}
                        step={0.05}
                        value={creativity}
                        onValueChange={(v) => {
                          setCreativity(v);
                          markDirty();
                        }}
                      />
                      <div className="mt-2 flex justify-between gap-1 px-0.5">
                        {CREATIVITY_MARKER_LABELS.map((label, i) => {
                          const at = CREATIVITY_MARKER_VALUES[i];
                          const isBalanced = label === 'Balanced';
                          return (
                            <div
                              key={label}
                              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center"
                            >
                              <button
                                type="button"
                                className="text-[0.625rem] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                                onClick={() => {
                                  setCreativity(at);
                                  markDirty();
                                }}
                              >
                                {label}
                              </button>
                              {isBalanced ? (
                                <span className="text-[0.5625rem] font-medium uppercase tracking-wide text-slate-400">
                                  Recommended
                                </span>
                              ) : (
                                <span className="h-3.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <Range
                        id={lengthId}
                        label="Response length"
                        labelTooltip={rangeDetailTooltip(RESPONSE_LENGTH_TOOLTIP_LINES)}
                        hint="Control how short or detailed responses should be."
                        min={MAX_TOKENS_MIN}
                        max={MAX_TOKENS_MAX}
                        step={MAX_TOKENS_STEP}
                        value={maxTokens}
                        onValueChange={(v) => {
                          setMaxTokens(v);
                          markDirty();
                        }}
                        valueSuffix="tokens"
                      />
                      <div className="mt-2 flex justify-between gap-1 px-0.5">
                        {LENGTH_MARKER_LABELS.map((label, i) => {
                          const at = LENGTH_MARKER_TOKENS[i];
                          const isStandard = label === 'Standard';
                          return (
                            <div
                              key={label}
                              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center"
                            >
                              <button
                                type="button"
                                className="text-[0.625rem] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                                onClick={() => {
                                  setMaxTokens(at);
                                  markDirty();
                                }}
                              >
                                {label}
                              </button>
                              {isStandard ? (
                                <span className="text-[0.5625rem] font-medium uppercase tracking-wide text-slate-400">
                                  Recommended
                                </span>
                              ) : (
                                <span className="h-3.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              </CardBody>
            </Card>

            <Card className={cardClass}>
              <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                <section className={ws.workspaceEditorCardSection} aria-labelledby="ai-training">
                  <WorkspaceSectionHeader
                    id="ai-training"
                    title="Training"
                    description="View the timestamp of your agent's last training and track when it was last updated with new content or sources."
                  />
                  <div className="mt-4 space-y-4">
                    <div
                      className="flex gap-3 rounded-lg border border-slate-200/80 bg-slate-50/90 px-3.5 py-3 ring-1 ring-slate-900/[0.02]"
                      role="status"
                      aria-live="polite"
                    >
                      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
                      <p className="m-0 text-sm leading-relaxed text-slate-700">
                        {lastTrainedLine ? (
                          <>
                            Last trained at <span className="font-medium">{lastTrainedLine}</span>
                          </>
                        ) : (
                          <>
                            No training run recorded yet. Training appears once your knowledge sources are indexed and
                            ready.
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span id="ai-auto-retrain-label" className={ws.workspaceEditorControlLabel}>
                            Auto-retrain
                          </span>
                          <Tooltip content="Coming soon" className="shrink-0">
                            <span className="inline-flex text-slate-400" aria-label="Auto-retrain not available yet">
                              <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                            </span>
                          </Tooltip>
                        </div>
                        <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
                          Automatically retrains every 24 hours and checks for the latest updates.
                        </p>
                      </div>
                      <Switch
                        id="ai-auto-retrain"
                        checked={false}
                        disabled
                        onCheckedChange={() => {}}
                        aria-label="Auto-retrain (coming soon)"
                        className="mt-0.5 shrink-0"
                      />
                    </div>
                  </div>
                </section>
              </CardBody>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
