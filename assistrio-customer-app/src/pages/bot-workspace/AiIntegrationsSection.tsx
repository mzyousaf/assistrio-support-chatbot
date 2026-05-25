import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Info, Loader2, Save } from 'lucide-react';
import { patchCustomerBot, type RefineResponseStyleResult } from '../../api/customerApi';
import { Button, Card, CardBody, Range, RangeMarkerRow, Switch, Tooltip } from '@/components/ui';
import { BotSettingsFieldset } from '@/components/bot-workspace/BotSettingsFieldset';
import { BOT_FIELD_MAX } from '@/lib/botFieldLimits';
import { buildAiAdvancedChatUiSavePayload, mergeChatUiFromBot } from './chatUiPayload';
import { cn } from '@/lib/utils';
import { toastPlaygroundSectionSaveFailed, toastPlaygroundSectionSaved } from '@/lib/playgroundSectionSaveToasts';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import {
  buildAiIntegrationsPreviewDraftSlice,
  clampCreativity,
  CREATIVITY_MARKER_LABELS,
  CREATIVITY_MARKER_POSITIONS,
  CREATIVITY_MARKER_VALUES,
  CREATIVITY_MAX,
  CREATIVITY_MIN,
  CREATIVITY_STEP,
  normalizeResponseStyleDescription,
  normalizeResponseStyleInstructions,
  resolveStructuredResponseFormatEnabledFromConfig,
  ANSWER_MODE_OPTIONS,
  normalizeAnswerMode,
  type AnswerMode,
  LENGTH_PRIMARY_MARKER_LABELS,
  LENGTH_PRIMARY_MARKER_POSITIONS,
  LENGTH_PRIMARY_MARKER_TOKENS,
  RESPONSE_LENGTH_RECOMMENDED_TOKENS,
  maxTokensToResponseLength,
  maxTokensToPresetIndex,
  presetIndexToMaxTokens,
  primaryPresetGroupIndex,
  RESPONSE_LENGTH_PRESET_COUNT,
  CREATIVITY_TOOLTIP_LINES,
  RESPONSE_LENGTH_TOOLTIP_LINES,
  snapMaxTokens,
} from './aiIntegrationsConstants';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ResponseStyleSection } from './ResponseStyleSection';
import { ws } from './workspace';

const PAGE_TITLE = 'AI & Advanced';
const SECTION_NAV_LABEL = 'AI & Advanced';

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

const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';

export function AiIntegrationsSection() {
  const creativityId = useId();
  const lengthId = useId();
  const { bot, botId, softReload, canManageBot } = useBotWorkspace();
  const { setAiIntegrationsDraftSlice, reloadPreviewWidget } = useCustomerWidgetPreview();

  const [creativity, setCreativity] = useState(0.5);
  const [maxTokens, setMaxTokens] = useState(160);
  const [answerMode, setAnswerMode] = useState<AnswerMode>('knowledge_first');
  const [structuredResponseFormatEnabled, setStructuredResponseFormatEnabled] = useState(false);
  const [responseStyleDescription, setResponseStyleDescription] = useState('');
  const [responseStyleInstructions, setResponseStyleInstructions] = useState('');
  const [responseStyleRefinedAt, setResponseStyleRefinedAt] = useState<string | undefined>();

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [allowFileUpload, setAllowFileUpload] = useState(false);
  const [showMic, setShowMic] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  const hydrateFromBot = useCallback(() => {
    if (!bot) return;
    const c = bot.config ?? {};
    const ui = mergeChatUiFromBot(bot.chatUI);

    const rawT = c.temperature;
    const t =
      typeof rawT === 'number' && Number.isFinite(rawT) ? clampCreativity(rawT) : 0.3;
    setCreativity(t);

    const rawM = c.maxTokens;
    const m =
      typeof rawM === 'number' && Number.isFinite(rawM)
        ? snapMaxTokens(rawM)
        : snapMaxTokens(160);
    setMaxTokens(m);

    const cfg = c as Record<string, unknown>;
    const enabled = resolveStructuredResponseFormatEnabledFromConfig(cfg);
    setAnswerMode(normalizeAnswerMode(cfg.answerMode));
    setStructuredResponseFormatEnabled(enabled);
    const rawDesc = c.responseStyleDescription;
    setResponseStyleDescription(
      enabled && typeof rawDesc === 'string'
        ? rawDesc.slice(0, BOT_FIELD_MAX.responseStyleDescription)
        : '',
    );
    const rawStyle = c.responseStyleInstructions;
    setResponseStyleInstructions(
      enabled && typeof rawStyle === 'string'
        ? rawStyle.slice(0, BOT_FIELD_MAX.responseStyleInstructions)
        : '',
    );
    const rawRefined = c.responseStyleRefinedAt;
    setResponseStyleRefinedAt(
      enabled && typeof rawRefined === 'string' ? rawRefined : undefined,
    );

    setAllowFileUpload(ui.allowFileUpload === true);
    setShowMic(ui.showMic === true);
    setShowVoice(ui.showVoice === true);

    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    hydrateFromBot();
  }, [hydrateFromBot]);

  useEffect(() => {
    return registerManualSaveGuard('ai-integrations', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

  useEffect(() => {
    if (!bot) {
      setAiIntegrationsDraftSlice(null);
      return;
    }
    setAiIntegrationsDraftSlice(
      buildAiIntegrationsPreviewDraftSlice({
        creativity,
        maxTokens,
        answerMode,
        structuredResponseFormatEnabled,
        responseStyleDescription,
        responseStyleInstructions,
        allowFileUpload,
        showMic,
        showVoice,
      }),
    );
  }, [
    bot,
    creativity,
    maxTokens,
    answerMode,
    structuredResponseFormatEnabled,
    responseStyleDescription,
    responseStyleInstructions,
    allowFileUpload,
    showMic,
    showVoice,
    setAiIntegrationsDraftSlice,
  ]);

  useEffect(() => {
    return () => setAiIntegrationsDraftSlice(null);
  }, [setAiIntegrationsDraftSlice]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError(null);
  }, []);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!bot || !botId || saving || !dirty) return;
      setSaving(true);
      setSaveError(null);

      const mt = snapMaxTokens(maxTokens);
      const style = normalizeResponseStyleInstructions(responseStyleInstructions);
      const desc = normalizeResponseStyleDescription(responseStyleDescription);
      const configPayload: Record<string, unknown> = {
        temperature: clampCreativity(creativity),
        maxTokens: mt,
        responseLength: maxTokensToResponseLength(mt),
        answerMode,
      };
      if (structuredResponseFormatEnabled && style) {
        configPayload.responseStyleMode = 'structured';
        configPayload.responseStyleInstructions = style;
        if (desc) configPayload.responseStyleDescription = desc;
        configPayload.responseStyleRefinedAt =
          responseStyleRefinedAt ?? new Date().toISOString();
      } else {
        configPayload.responseStyleMode = null;
        configPayload.responseStyleInstructions = null;
        configPayload.responseStyleDescription = null;
        configPayload.responseStyleRefinedAt = null;
      }
      const res = await patchCustomerBot(botId, {
        config: configPayload,
        chatUI: buildAiAdvancedChatUiSavePayload(bot.chatUI, { allowFileUpload, showMic, showVoice }),
      });
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        toastPlaygroundSectionSaveFailed('aiIntegrations', res.error);
        return;
      }
      toastPlaygroundSectionSaved('aiIntegrations');
      setDirty(false);
      await softReload();
      reloadPreviewWidget();
    },
    [
      bot,
      botId,
      creativity,
      dirty,
      maxTokens,
      answerMode,
      structuredResponseFormatEnabled,
      responseStyleDescription,
      responseStyleInstructions,
      responseStyleRefinedAt,
      allowFileUpload,
      showMic,
      showVoice,
      softReload,
      reloadPreviewWidget,
      saving,
    ],
  );

  if (!bot || !botId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-ai-advanced-editor>
      <form
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => void onSubmit(e)}
        aria-label="AI and advanced settings"
      >
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>{PAGE_TITLE}</h1>
                <p className={ws.workspaceEditorLead}>
                  Model tuning and composer attachments / voice input for the widget.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col sm:pt-0">
              {canManageBot ? (
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
                aria-label={saving ? `Saving ${SECTION_NAV_LABEL}` : `Save ${SECTION_NAV_LABEL}`}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving AI & Advanced…
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save AI & Advanced
                  </>
                )}
              </Button>
              ) : null}
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

          <BotSettingsFieldset canManage={canManageBot}>
          <div className={ws.workspaceEditorCardGap}>
            <Card className={cardClass}>
              <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                <section className={ws.workspaceEditorCardSection} aria-labelledby="ai-response-style">
                  <WorkspaceSectionHeader
                    id="ai-response-style"
                    title="Response style"
                    description="Adjust creativity and how much detail the assistant uses in replies."
                  />

                  <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 md:items-start">
                    <div className="flex min-w-0 flex-col gap-3">
                      <Range
                        id={creativityId}
                        label="Creativity"
                        labelTooltip={rangeDetailTooltip(CREATIVITY_TOOLTIP_LINES)}
                        hint="Lower values keep answers more consistent. Higher values allow more variation."
                        variant="sliderOnly"
                        min={CREATIVITY_MIN}
                        max={CREATIVITY_MAX}
                        step={CREATIVITY_STEP}
                        value={creativity}
                        onValueChange={(v) => {
                          setCreativity(v);
                          markDirty();
                        }}
                      />
                      <RangeMarkerRow
                        positions={CREATIVITY_MARKER_POSITIONS}
                        markers={CREATIVITY_MARKER_LABELS.map((label, i) => {
                          const at = CREATIVITY_MARKER_VALUES[i];
                          return {
                            label,
                            recommended: label === 'Balanced',
                            active: Math.abs(clampCreativity(creativity) - at) < 0.026,
                            onSelect: () => {
                              setCreativity(at);
                              markDirty();
                            },
                          };
                        })}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col gap-3">
                      <Range
                        id={lengthId}
                        label="Response length"
                        labelTooltip={rangeDetailTooltip(RESPONSE_LENGTH_TOOLTIP_LINES)}
                        hint="Control how short or detailed responses should be."
                        variant="trackBadges"
                        showTrackValue={false}
                        min={0}
                        max={RESPONSE_LENGTH_PRESET_COUNT - 1}
                        step={1}
                        value={maxTokensToPresetIndex(maxTokens)}
                        onValueChange={(presetIndex) => {
                          setMaxTokens(presetIndexToMaxTokens(presetIndex));
                          markDirty();
                        }}
                      />
                      <RangeMarkerRow
                        positions={LENGTH_PRIMARY_MARKER_POSITIONS}
                        markers={LENGTH_PRIMARY_MARKER_LABELS.map((label, i) => {
                          const at = LENGTH_PRIMARY_MARKER_TOKENS[i];
                          return {
                            label,
                            recommended: at === RESPONSE_LENGTH_RECOMMENDED_TOKENS,
                            active: primaryPresetGroupIndex(maxTokens) === i,
                            onSelect: () => {
                              setMaxTokens(at);
                              markDirty();
                            },
                          };
                        })}
                      />
                    </div>
                  </div>

                  <div className="mt-8 border-t border-slate-100 pt-6" data-testid="answer-behavior-section">
                    <p className={ws.workspaceEditorControlLabel}>Answer behavior</p>
                    <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
                      Control whether the assistant can answer general or creative questions that are not
                      explicitly in the knowledge base.
                    </p>
                    <div
                      className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label="Answer behavior"
                    >
                      {ANSWER_MODE_OPTIONS.map((opt) => {
                        const selected = answerMode === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            data-testid={`answer-mode-${opt.value}`}
                            className={cn(
                              'rounded-xl border px-4 py-3 text-left transition-colors',
                              selected
                                ? 'border-teal-600 bg-teal-50/80 ring-1 ring-teal-600/30'
                                : 'border-slate-200 bg-white hover:border-slate-300',
                            )}
                            onClick={() => {
                              setAnswerMode(opt.value);
                              markDirty();
                            }}
                          >
                            <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                            {opt.recommended ? (
                              <span className="ml-2 text-[0.625rem] font-semibold uppercase tracking-wide text-teal-700">
                                Recommended
                              </span>
                            ) : null}
                            <p className={cn(ws.workspaceEditorControlHint, 'mt-1.5')}>{opt.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {botId ? (
                    <ResponseStyleSection
                      botId={botId}
                      enabled={structuredResponseFormatEnabled}
                      description={responseStyleDescription}
                      instructions={responseStyleInstructions}
                      onEnabledChange={setStructuredResponseFormatEnabled}
                      onRefined={(result: RefineResponseStyleResult) => {
                        setStructuredResponseFormatEnabled(true);
                        setResponseStyleDescription(result.description);
                        setResponseStyleInstructions(result.instructions);
                        setResponseStyleRefinedAt(new Date().toISOString());
                      }}
                      onTurnOff={() => {
                        setStructuredResponseFormatEnabled(false);
                        setResponseStyleDescription('');
                        setResponseStyleInstructions('');
                        setResponseStyleRefinedAt(undefined);
                      }}
                      markDirty={markDirty}
                    />
                  ) : null}
                </section>
              </CardBody>
            </Card>

            <Card className={cardClass}>
              <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                <section className={ws.workspaceEditorCardSection} aria-labelledby="ai-composer-input">
                  <WorkspaceSectionHeader
                    id="ai-composer-input"
                    title="Chat composer"
                    description="File attachments, microphone (dictate), and voice control in the widget composer."
                  />
                  <div className="mt-4 space-y-0">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span id="ai-allow-file-label" className={ws.workspaceEditorControlLabel}>
                            Allow file uploads
                          </span>
                          <Tooltip content="Visitors can attach files from the + control in the composer.">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                              aria-label="About file uploads"
                            >
                              <Info size={14} strokeWidth={1.75} aria-hidden />
                            </button>
                          </Tooltip>
                        </div>
                        <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
                          Let visitors attach files in the widget composer.
                        </p>
                      </div>
                      <Switch
                        id="ai-allow-file"
                        checked={allowFileUpload}
                        onCheckedChange={(v) => {
                          setAllowFileUpload(v);
                          markDirty();
                        }}
                        aria-labelledby="ai-allow-file-label"
                        className="mt-0.5 shrink-0"
                      />
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span id="ai-show-mic-label" className={ws.workspaceEditorControlLabel}>
                            Microphone (dictate)
                          </span>
                          <Tooltip content="Shows the mic control for speech-to-text when your workspace supports Whisper.">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                              aria-label="About microphone"
                            >
                              <Info size={14} strokeWidth={1.75} aria-hidden />
                            </button>
                          </Tooltip>
                        </div>
                        <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
                          Dictate control beside the message field.
                        </p>
                      </div>
                      <Switch
                        id="ai-show-mic"
                        checked={showMic}
                        onCheckedChange={(v) => {
                          setShowMic(v);
                          markDirty();
                        }}
                        aria-labelledby="ai-show-mic-label"
                        className="mt-0.5 shrink-0"
                      />
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-3.5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span id="ai-show-voice-label" className={ws.workspaceEditorControlLabel}>
                            Voice input
                          </span>
                          <Tooltip content="Shows the voice (waveform) control. Often used with the same speech pipeline as the microphone.">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                              aria-label="About voice input"
                            >
                              <Info size={14} strokeWidth={1.75} aria-hidden />
                            </button>
                          </Tooltip>
                        </div>
                        <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
                          Separate voice control next to the send button.
                        </p>
                      </div>
                      <Switch
                        id="ai-show-voice"
                        checked={showVoice}
                        onCheckedChange={(v) => {
                          setShowVoice(v);
                          markDirty();
                        }}
                        aria-labelledby="ai-show-voice-label"
                        className="mt-0.5 shrink-0"
                      />
                    </div>
                  </div>
                </section>
              </CardBody>
            </Card>

          </div>
          </BotSettingsFieldset>
        </div>
      </form>
    </div>
  );
}
