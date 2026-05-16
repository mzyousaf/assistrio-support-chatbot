import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Info, Loader2, Save } from 'lucide-react';
import { patchCustomerBot } from '../../api/customerApi';
import { Button, Card, CardBody, Range, Switch, Tooltip } from '@/components/ui';
import { buildAiAdvancedChatUiSavePayload, mergeChatUiFromBot } from './chatUiPayload';
import { cn } from '@/lib/utils';
import { toastPlaygroundSectionSaveFailed, toastPlaygroundSectionSaved } from '@/lib/playgroundSectionSaveToasts';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import {
  clampCreativity,
  CREATIVITY_MARKER_LABELS,
  CREATIVITY_MARKER_VALUES,
  LENGTH_MARKER_LABELS,
  LENGTH_MARKER_TOKENS,
  maxTokensToResponseLength,
  MAX_TOKENS_MAX,
  MAX_TOKENS_MIN,
  MAX_TOKENS_STEP,
  CREATIVITY_TOOLTIP_LINES,
  RESPONSE_LENGTH_TOOLTIP_LINES,
  snapMaxTokens,
} from './aiIntegrationsConstants';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ws } from './workspace';
import { Link } from 'react-router-dom';

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

const AI_INTEGRATIONS_PREVIEW_DEBOUNCE_MS = 150;

export function AiIntegrationsSection() {
  const creativityId = useId();
  const lengthId = useId();
  const { bot, botId, softReload } = useBotWorkspace();
  const { setAiIntegrationsDraftSlice } = useCustomerWidgetPreview();

  const [creativity, setCreativity] = useState(0.5);
  const [maxTokens, setMaxTokens] = useState(512);

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
        : snapMaxTokens(512);
    setMaxTokens(m);

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
    const id = window.setTimeout(() => {
      const mt = snapMaxTokens(maxTokens);
      setAiIntegrationsDraftSlice({
        personality: {},
        config: {
          temperature: clampCreativity(creativity),
          maxTokens: mt,
          responseLength: maxTokensToResponseLength(mt),
        },
        chatUiAdvanced: { allowFileUpload, showMic, showVoice },
      });
    }, AI_INTEGRATIONS_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [bot, creativity, maxTokens, allowFileUpload, showMic, showVoice, setAiIntegrationsDraftSlice]);

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
      const res = await patchCustomerBot(botId, {
        config: {
          temperature: clampCreativity(creativity),
          maxTokens: mt,
          responseLength: maxTokensToResponseLength(mt),
        },
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
    },
    [bot, botId, creativity, dirty, maxTokens, allowFileUpload, showMic, showVoice, softReload, saving],
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
                <section className={ws.workspaceEditorCardSection} aria-labelledby="translation-settings-link">
                  <WorkspaceSectionHeader
                    id="translation-settings-link"
                    title="Translation settings"
                    description="Language behavior moved to a dedicated Translation page."
                  />
                  <div className="mt-3">
                    <Link to={`/bots/${botId}/playground/translation`} className="text-sm font-medium text-teal-700 hover:text-teal-800">
                      Manage translation settings
                    </Link>
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
        </div>
      </form>
    </div>
  );
}
