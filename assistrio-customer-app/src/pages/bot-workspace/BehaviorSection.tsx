import { useId, useRef, useState } from 'react';
import { Loader2, MessageCircle, Pencil, Plus, Save, Sparkles, Trash2, type LucideIcon } from 'lucide-react';
import {
  BEHAVIOR_PRESETS,
  DEFAULT_PRESET_HELPER,
  CATEGORY_OPTIONS,
  CUSTOM_CATEGORY_PILL,
  EXAMPLE_QUESTIONS_MAX,
  EXAMPLE_QUESTION_MAX_CHARS,
  MAX_CATEGORY_PILLS,
  PERSONALITY_DESCRIPTION_MAX,
  THINGS_TO_AVOID_MAX,
  TONE_OPTIONS,
  WELCOME_MESSAGE_MAX,
} from './behaviorConstants';
import { useBehaviorWorkspace, type BehaviorSubnav } from './BehaviorWorkspaceContext';
import { WELCOME_KEYWORD_PILLS, WelcomeMessageKeywordPreview } from './welcomeMessageKeywords';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ws } from './workspace';
import { Button, Card, CardBody, FieldRow, Input, Label, Modal, Select, Switch, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';

const PAGE_TITLE = 'Agent behavior';

function RecommendedCharLabelAddon({ length, max }: { length: number; max: number }) {
  const over = length > max;
  return (
    <span
      className={cn(
        'ml-auto shrink-0 text-xs tabular-nums leading-tight text-slate-500',
        over && 'text-amber-800',
      )}
      aria-live="polite"
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

const SUBNAV: { id: BehaviorSubnav; label: string; hint: string; icon: LucideIcon }[] = [
  {
    id: 'personality',
    label: 'Personality',
    hint: 'Categories, tone, and instructions that shape every reply.',
    icon: Sparkles,
  },
  {
    id: 'first-message',
    label: 'Agent First Message(s)',
    hint: 'Welcome line and quick prompts for new chats.',
    icon: MessageCircle,
  },
];

export function BehaviorSection() {
  const subnavId = useId();
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    activeSubnav,
    setActiveSubnav,
    dirty,
    selectedCategories,
    customCategoryMode,
    customCategoryText,
    setCustomCategoryText,
    toggleCategoryPill,
    behaviorPreset,
    setBehaviorPreset,
    tone,
    setTone,
    personalityDescription,
    setPersonalityDescription,
    thingsToAvoid,
    setThingsToAvoid,
    welcomeMessage,
    setWelcomeMessage,
    welcomeMessageEnabled,
    setWelcomeMessageEnabled,
    exampleQuestions,
    setExampleQuestions,
    saving,
    saveError,
    save,
  } = useBehaviorWorkspace();

  const [suggestedQuestionDeleteIndex, setSuggestedQuestionDeleteIndex] = useState<number | null>(null);
  const [suggestedQuestionModal, setSuggestedQuestionModal] = useState<
    null | { mode: 'create' } | { mode: 'edit'; index: number }
  >(null);
  const [suggestedQuestionDraft, setSuggestedQuestionDraft] = useState('');

  function closeSuggestedQuestionDeleteModal() {
    setSuggestedQuestionDeleteIndex(null);
  }

  function confirmSuggestedQuestionDelete() {
    if (suggestedQuestionDeleteIndex === null) return;
    const idx = suggestedQuestionDeleteIndex;
    setExampleQuestions(exampleQuestions.filter((_, i) => i !== idx));
    setSuggestedQuestionDeleteIndex(null);
  }

  const suggestedQuestionPendingText =
    suggestedQuestionDeleteIndex !== null ? exampleQuestions[suggestedQuestionDeleteIndex] ?? '' : '';

  function closeSuggestedQuestionEditModal() {
    setSuggestedQuestionModal(null);
    setSuggestedQuestionDraft('');
  }

  function commitSuggestedQuestionModal() {
    const t = suggestedQuestionDraft.trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS);
    if (!suggestedQuestionModal || !t) return;
    if (suggestedQuestionModal.mode === 'create') {
      if (exampleQuestions.length >= EXAMPLE_QUESTIONS_MAX) return;
      setExampleQuestions([...exampleQuestions, t]);
    } else {
      const i = suggestedQuestionModal.index;
      const next = [...exampleQuestions];
      if (next[i] === undefined) return;
      next[i] = t;
      setExampleQuestions(next);
    }
    closeSuggestedQuestionEditModal();
  }

  function insertWelcomeKeyword(token: string) {
    if (!welcomeMessageEnabled) return;
    const el = welcomeTextareaRef.current;
    const start = el?.selectionStart ?? welcomeMessage.length;
    const end = el?.selectionEnd ?? welcomeMessage.length;
    const next = welcomeMessage.slice(0, start) + token + welcomeMessage.slice(end);
    setWelcomeMessage(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const activeMeta = SUBNAV.find((s) => s.id === activeSubnav);

  const categorySlotsUsed = customCategoryMode ? 1 : selectedCategories.length;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-behavior-editor>
      <form
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        aria-label="Behavior settings"
      >
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>{PAGE_TITLE}</h1>
                <p className={ws.workspaceEditorLead}>
                  Shape tone, categories, and opening messages—so every reply matches how you want your agent to
                  sound and start chats.
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
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save behavior
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

          <div className={ws.workspaceEditorSubnavSection}>
            <div className={ws.workspaceEditorSubnavBar}>
              <div
                className="flex flex-wrap items-end gap-x-1 sm:gap-x-1.5"
                role="tablist"
                aria-label="Behavior sections"
                id={subnavId}
              >
                {SUBNAV.map((tab) => {
                  const selected = activeSubnav === tab.id;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`${subnavId}-${tab.id}-panel`}
                      id={`${subnavId}-${tab.id}-tab`}
                      className={cn(
                        'relative z-[1] box-border -mb-px inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-t-md border border-solid px-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-3',
                        selected
                          ? 'border-slate-200 border-b-white bg-white text-[var(--color-teal-700)]'
                          : 'border-transparent text-slate-600 hover:border-slate-200/90 hover:bg-slate-50/60 hover:text-slate-900',
                      )}
                      onClick={() => {
                        setActiveSubnav(tab.id);
                      }}
                    >
                      <TabIcon size={16} strokeWidth={2} className="shrink-0 opacity-90" aria-hidden />
                      <span className="min-w-0 truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {activeMeta ? (
              <p className={ws.workspaceEditorTabContext}>{activeMeta.hint}</p>
            ) : null}
          </div>

          <div className={ws.workspaceEditorCardGap}>
            {activeSubnav === 'personality' ? (
              <div
                id={`${subnavId}-personality-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-personality-tab`}
                className={ws.workspaceEditorCardGap}
              >
                {/* 1. Category */}
                <Card className="w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                  <CardBody className="w-full min-w-0 overflow-visible px-5 py-5 sm:px-6 sm:py-6">
                    <section className={cn(ws.workspaceEditorCardSection, 'overflow-visible')} aria-labelledby={`${subnavId}-cat-h`}>
                      <WorkspaceSectionHeader
                        id={`${subnavId}-cat-h`}
                        title="Category"
                        titleAddon={
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
                            {categorySlotsUsed}/{MAX_CATEGORY_PILLS}
                          </span>
                        }
                        description="Pick up to three presets, or switch to custom when your use case isn’t listed."
                        tooltip="Categories help the model understand context. They are not pulled from your knowledge base as facts."
                      />
                      <div
                        className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5"
                        role="group"
                        aria-label="Category presets"
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORY_OPTIONS.map((c) => {
                            const selected = !customCategoryMode && selectedCategories.includes(c.value);
                            const atMax =
                              !customCategoryMode &&
                              selectedCategories.length >= MAX_CATEGORY_PILLS &&
                              !selected;
                            return (
                              <button
                                key={c.value}
                                type="button"
                                className={cn(
                                  'inline-flex h-[30px] max-h-[30px] min-h-0 shrink-0 items-center justify-center rounded-full border px-2 text-[0.6875rem] leading-none transition-colors duration-150',
                                  selected ? 'font-medium' : 'font-normal',
                                  selected
                                    ? 'cursor-pointer border-[var(--color-teal-600)] bg-[var(--teal-50)] text-[var(--color-teal-800)] hover:bg-[color-mix(in_srgb,var(--teal-50)_92%,var(--color-teal-600)_8%)]'
                                    : atMax
                                      ? 'cursor-not-allowed border-slate-200/80 bg-slate-50/80 text-slate-400'
                                      : 'cursor-pointer border-slate-200/90 bg-white text-slate-700 hover:border-slate-300/90 hover:bg-slate-100/70',
                                )}
                                disabled={atMax}
                                aria-pressed={selected}
                                onClick={() => toggleCategoryPill(c.value)}
                              >
                                {c.label}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            className={cn(
                              'inline-flex h-[30px] max-h-[30px] min-h-0 shrink-0 items-center justify-center rounded-full border px-2 text-[0.6875rem] leading-none transition-colors duration-150',
                              customCategoryMode ? 'font-medium' : 'font-normal',
                              customCategoryMode
                                ? 'cursor-pointer border-[var(--color-teal-600)] bg-[var(--teal-50)] text-[var(--color-teal-800)] hover:bg-[color-mix(in_srgb,var(--teal-50)_92%,var(--color-teal-600)_8%)]'
                                : 'cursor-pointer border-dashed border-slate-300/90 bg-white text-slate-600 hover:border-slate-400/90 hover:bg-slate-100/60',
                            )}
                            aria-pressed={customCategoryMode}
                            onClick={() => toggleCategoryPill(CUSTOM_CATEGORY_PILL)}
                          >
                            Custom / other
                          </button>
                        </div>
                      </div>
                      <p className={ws.workspaceEditorHelperText}>
                        Your selections shape how open-ended replies can be and how strongly category context
                        impacts each answer.
                      </p>
                      <FieldRow
                        label="Custom category"
                        htmlFor="behavior-custom-cat"
                        helperText={
                          customCategoryMode
                            ? 'Use when no preset matches.'
                            : 'Choose Custom / other above to enter your own wording.'
                        }
                        className="mt-3 min-w-0 gap-1.5"
                      >
                        <Input
                          id="behavior-custom-cat"
                          quiet
                          disabled={!customCategoryMode}
                          value={customCategoryText}
                          placeholder="e.g. real estate, internal IT"
                          onChange={(e) => setCustomCategoryText(e.target.value)}
                        />
                      </FieldRow>
                    </section>
                  </CardBody>
                </Card>

                {/* 2. Personality */}
                <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby={`${subnavId}-pers-h`}>
                      <WorkspaceSectionHeader
                        id={`${subnavId}-pers-h`}
                        title="Personality"
                        description="Start from a preset, then extend with your own instructions."
                        tooltip="Preset and tone set defaults; these instructions are merged into the assistant’s behavior context."
                      />
                      <div className={ws.workspaceEditorFieldStack}>
                        <FieldRow
                          label="Preset"
                          htmlFor="behavior-preset"
                          className="min-w-0 gap-1.5"
                          helperText={
                            behaviorPreset === 'default'
                              ? DEFAULT_PRESET_HELPER
                              : 'Adds a starter role; your instructions still extend or override details below.'
                          }
                        >
                          <Select
                            id="behavior-preset"
                            quiet
                            value={behaviorPreset}
                            onChange={(e) => setBehaviorPreset(e.target.value)}
                          >
                            {BEHAVIOR_PRESETS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </Select>
                        </FieldRow>
                        <FieldRow
                          label="Tone"
                          htmlFor="behavior-tone"
                          className="min-w-0 gap-1.5"
                          helperText="How the assistant sounds in replies—voice, warmth, and formality."
                        >
                          <Select id="behavior-tone" quiet value={tone} onChange={(e) => setTone(e.target.value)}>
                            {TONE_OPTIONS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </Select>
                        </FieldRow>
                        <FieldRow
                          label="Instructions"
                          htmlFor="behavior-desc"
                          required
                          className="gap-1.5"
                          helperText="What the assistant should do and how—merged into the system prompt with your preset."
                          labelAddon={
                            <RecommendedCharLabelAddon
                              length={personalityDescription.length}
                              max={PERSONALITY_DESCRIPTION_MAX}
                            />
                          }
                        >
                          <Textarea
                            id="behavior-desc"
                            quiet
                            rows={5}
                            value={personalityDescription}
                            placeholder="Extend or customize how the agent should behave—priorities, style, and boundaries."
                            className={cn(
                              ws.workspaceEditorControlInput,
                              'min-h-[7rem] resize-y border-slate-200/90 py-2.5',
                            )}
                            maxLength={PERSONALITY_DESCRIPTION_MAX}
                            onChange={(e) => setPersonalityDescription(e.target.value)}
                          />
                        </FieldRow>
                      </div>
                    </section>
                  </CardBody>
                </Card>

                {/* 3. Things to avoid */}
                <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby={`${subnavId}-avoid-h`}>
                      <WorkspaceSectionHeader
                        id={`${subnavId}-avoid-h`}
                        title="Things to avoid"
                        description="Optional. Sets when the assistant should refuse, hedge, or redirect—so risky or off-topic requests don’t get full answers."
                        tooltip="This text is added to the model’s behavior context; keep it high-level, not company facts (those belong in knowledge)."
                      />
                      <FieldRow
                        label="Avoid instructions"
                        htmlFor="behavior-avoid"
                        className="gap-1.5"
                        helperText="Short red lines only—one idea per line is fine. Put detailed facts, policies, and FAQs in Knowledge, not here."
                        labelAddon={
                          <RecommendedCharLabelAddon
                            length={thingsToAvoid.length}
                            max={THINGS_TO_AVOID_MAX}
                          />
                        }
                      >
                        <Textarea
                          id="behavior-avoid"
                          quiet
                          rows={4}
                          value={thingsToAvoid}
                          placeholder="e.g. medical diagnoses, competitor comparisons, off-topic banter"
                          className={cn(
                            ws.workspaceEditorControlInput,
                            'min-h-[5rem] resize-y border-slate-200/90 py-2.5',
                          )}
                          maxLength={THINGS_TO_AVOID_MAX}
                          onChange={(e) => setThingsToAvoid(e.target.value)}
                        />
                      </FieldRow>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeSubnav === 'first-message' ? (
              <div
                id={`${subnavId}-first-message-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-first-message-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby={`${subnavId}-welcome-h`}>
                      <WorkspaceSectionHeader
                        id={`${subnavId}-welcome-h`}
                        title="Welcome message"
                        description="The first assistant message visitors see when the thread is empty."
                        inlineEnd={
                          <Switch
                            checked={welcomeMessageEnabled}
                            onCheckedChange={setWelcomeMessageEnabled}
                            aria-label="Use a custom welcome message"
                          />
                        }
                        tooltip="Plain text and Key Words from your Profile (Name, Tagline, Description)."
                      />
                      <div
                        className={cn(
                          'flex flex-col gap-3',
                          !welcomeMessageEnabled && 'opacity-[0.72]',
                        )}
                      >
                        <div className="flex w-full min-h-[1.125rem] items-center gap-2">
                          <Label htmlFor="behavior-welcome-msg">Message text</Label>
                          <RecommendedCharLabelAddon
                            length={welcomeMessage.length}
                            max={WELCOME_MESSAGE_MAX}
                          />
                        </div>
                        <p className={cn(ws.workspaceEditorHelperText, 'm-0')}>
                          Click a pill to insert that Key Word. Key Words are highlighted in the preview below.
                        </p>
                        <div
                          className={cn(
                            'rounded-lg border border-slate-100 bg-slate-50/80 p-2.5',
                            !welcomeMessageEnabled && 'pointer-events-none',
                          )}
                          role="group"
                          aria-label="Insert Key Words"
                          aria-hidden={!welcomeMessageEnabled || undefined}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            {WELCOME_KEYWORD_PILLS.map((pill) => (
                              <button
                                key={pill.value}
                                type="button"
                                className={cn(
                                  'inline-flex h-[30px] max-h-[30px] min-h-0 shrink-0 items-center justify-center rounded-full border px-2 text-[0.6875rem] font-medium leading-none transition-colors duration-150',
                                  welcomeMessageEnabled
                                    ? 'cursor-pointer border-slate-200/90 bg-white text-slate-700 hover:border-slate-300/90 hover:bg-slate-100/70'
                                    : 'cursor-not-allowed border-slate-200/80 bg-slate-50/80 text-slate-400',
                                )}
                                disabled={!welcomeMessageEnabled}
                                onClick={() => insertWelcomeKeyword(pill.value)}
                              >
                                {pill.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Textarea
                          ref={welcomeTextareaRef}
                          id="behavior-welcome-msg"
                          quiet
                          rows={4}
                          disabled={!welcomeMessageEnabled}
                          value={welcomeMessage}
                          placeholder="Hi there—what can we help you find today?"
                          maxLength={WELCOME_MESSAGE_MAX}
                          className={cn(
                            ws.workspaceEditorControlInput,
                            'min-h-[5rem] resize-y border-slate-200/90 py-2.5',
                          )}
                          onChange={(e) => setWelcomeMessage(e.target.value)}
                        />
                        {!welcomeMessageEnabled ? (
                          <p className="m-0 text-[0.6875rem] leading-snug text-slate-400">
                            Turn on the switch above to edit and save a custom welcome line.
                          </p>
                        ) : null}
                        <div
                          className={cn(
                            'flex flex-col gap-1.5',
                            !welcomeMessageEnabled && 'pointer-events-none',
                          )}
                          aria-hidden={!welcomeMessageEnabled || undefined}
                        >
                          <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                            Preview
                          </p>
                          <div
                            className="min-h-[3rem] rounded-lg border border-slate-200/90 bg-slate-50/50 px-3 py-2.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                            aria-live="polite"
                          >
                            <WelcomeMessageKeywordPreview text={welcomeMessage} />
                          </div>
                        </div>
                      </div>
                    </section>
                  </CardBody>
                </Card>

                <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby={`${subnavId}-sq-h`}>
                      <WorkspaceSectionHeader
                        id={`${subnavId}-sq-h`}
                        title="Suggested questions"
                        titleAddon={
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
                            {exampleQuestions.length}/{EXAMPLE_QUESTIONS_MAX}
                          </span>
                        }
                        inlineEnd={
                          exampleQuestions.length < EXAMPLE_QUESTIONS_MAX ? (
                            <Button
                              type="button"
                              variant="outlinePrimary"
                              size="sm"
                              className="shrink-0 cursor-pointer"
                              onClick={() => {
                                setSuggestedQuestionDraft('');
                                setSuggestedQuestionModal({ mode: 'create' });
                              }}
                            >
                              <Plus size={14} strokeWidth={2} aria-hidden />
                              Add question
                            </Button>
                          ) : null
                        }
                        description="Short chips visitors can tap to start—keep them specific to your business."
                      />
                      {exampleQuestions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/70 px-5 py-10 text-center sm:px-8 sm:py-12">
                          <h3 className={cn(ws.workspaceEditorSubsectionTitle, 'text-center')}>
                            No suggested questions yet
                          </h3>
                          <p className={cn(ws.workspaceEditorHelperText, 'mx-auto mt-2 max-w-md text-center leading-relaxed')}>
                            Add up to {EXAMPLE_QUESTIONS_MAX} short prompts. They appear as tappable chips so visitors can
                            start in one tap. Use <span className="font-medium text-slate-600">Add question</span> to open
                            the editor.
                          </p>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="mt-5"
                            onClick={() => {
                              setSuggestedQuestionDraft('');
                              setSuggestedQuestionModal({ mode: 'create' });
                            }}
                          >
                            Add your first question
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.03]">
                            <ul className="m-0 divide-y divide-slate-100 p-0" role="list">
                              {exampleQuestions.map((q, index) => (
                                <li key={index}>
                                  <div className="flex min-w-0 items-start gap-3 px-3 py-3 sm:items-center sm:px-4 sm:py-3.5">
                                    <span
                                      className="mt-0.5 flex h-6 min-w-[1.375rem] shrink-0 items-center justify-center rounded-[5px] bg-slate-100 px-1 text-[0.625rem] font-semibold tabular-nums leading-none text-slate-600 ring-1 ring-slate-200/90 sm:mt-0"
                                      aria-hidden
                                    >
                                      {index + 1}
                                    </span>
                                    <p className="m-0 min-w-0 flex-1 text-sm leading-relaxed text-slate-800">
                                      {q.trim() ? (
                                        <span className="line-clamp-3">{q}</span>
                                      ) : (
                                        <span className="text-slate-400">Empty question</span>
                                      )}
                                    </p>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="gap-0 px-2"
                                        onClick={() => {
                                          setSuggestedQuestionDraft(q);
                                          setSuggestedQuestionModal({ mode: 'edit', index });
                                        }}
                                        aria-label={`Edit suggested question ${index + 1}`}
                                      >
                                        <Pencil size={14} strokeWidth={2} aria-hidden />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          'cursor-pointer rounded-md px-2 text-slate-500',
                                          '[&_svg]:text-slate-500 [&_svg]:transition-colors',
                                          'hover:enabled:bg-red-50 hover:enabled:text-[var(--color-danger-text-emphasis)]',
                                          'hover:enabled:[&_svg]:text-[var(--color-danger-text-emphasis)]',
                                        )}
                                        onClick={() => setSuggestedQuestionDeleteIndex(index)}
                                        aria-label={`Remove suggested question ${index + 1}`}
                                      >
                                        <Trash2 size={15} strokeWidth={2} aria-hidden />
                                      </Button>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                          {exampleQuestions.length >= EXAMPLE_QUESTIONS_MAX ? (
                            <p className={cn(ws.workspaceEditorHelperText, 'm-0')}>
                              You have added the maximum of {EXAMPLE_QUESTIONS_MAX} suggested questions.
                            </p>
                          ) : null}
                        </div>
                      )}
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </form>

      <Modal
        open={suggestedQuestionModal != null}
        onClose={closeSuggestedQuestionEditModal}
        title={suggestedQuestionModal?.mode === 'edit' ? 'Edit suggested question' : 'Add suggested question'}
        description="Short prompts appear as tappable chips in new chats. Save behavior settings to apply."
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={closeSuggestedQuestionEditModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="behavior-suggested-question-form"
              variant="primary"
              size="sm"
              disabled={!suggestedQuestionDraft.trim()}
            >
              {suggestedQuestionModal?.mode === 'edit' ? 'Save' : 'Add'}
            </Button>
          </>
        }
      >
        <form
          id="behavior-suggested-question-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            commitSuggestedQuestionModal();
          }}
        >
          <FieldRow
            label="Question"
            htmlFor="behavior-sq-draft"
            helperText="Keep it short and specific to your business."
            labelRowClassName="w-full min-w-0"
            labelAddon={
              <RecommendedCharLabelAddon
                length={suggestedQuestionDraft.length}
                max={EXAMPLE_QUESTION_MAX_CHARS}
              />
            }
          >
            <Input
              id="behavior-sq-draft"
              quiet
              value={suggestedQuestionDraft}
              placeholder="What services do you offer?"
              autoComplete="off"
              maxLength={EXAMPLE_QUESTION_MAX_CHARS}
              onChange={(e) => setSuggestedQuestionDraft(e.target.value.slice(0, EXAMPLE_QUESTION_MAX_CHARS))}
            />
          </FieldRow>
        </form>
      </Modal>

      <Modal
        open={suggestedQuestionDeleteIndex !== null}
        onClose={closeSuggestedQuestionDeleteModal}
        title="Remove suggested question?"
        tone="danger"
        description={
          suggestedQuestionDeleteIndex !== null
            ? suggestedQuestionPendingText.trim()
              ? (
                  <span className="font-medium text-slate-800">
                    &ldquo;
                    {suggestedQuestionPendingText.trim().length > 72
                      ? `${suggestedQuestionPendingText.trim().slice(0, 72)}…`
                      : suggestedQuestionPendingText.trim()}
                    &rdquo;
                  </span>
                )
              : 'This permanently removes the question from your list. This action cannot be undone.'
            : null
        }
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={closeSuggestedQuestionDeleteModal}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={confirmSuggestedQuestionDelete}>
              Remove question
            </Button>
          </>
        }
      >
        <p className={cn(ws.workspaceEditorHelperText, 'm-0')}>
          This action cannot be undone. You can add a new suggested question later with <span className="font-medium text-slate-700">Add question</span>.
        </p>
      </Modal>
    </div>
  );
}
