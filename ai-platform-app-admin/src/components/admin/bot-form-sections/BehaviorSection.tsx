"use client";

import LeadCaptureEditor from "@/components/admin/LeadCaptureEditor";
import {
  SettingsPageHeader,
  SettingsSectionCard,
  SettingsFieldRow,
  SettingsToggleRow,
} from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import MultiSelect from "@/components/ui/MultiSelect";
import { Textarea } from "@/components/ui/Textarea";
import type { BotPersonality } from "@/models/Bot";

import { BOT_FIELD_MAX } from "@/lib/botFieldLimits";
import { useBotFormEditor } from "./BotFormEditorContext";
import {
  BEHAVIOR_PRESETS,
  DEFAULT_PRESET_HELPER,
  TONE_OPTIONS,
  CATEGORY_OPTIONS,
  EXAMPLE_QUESTIONS_MAX,
  TAB_CONTENT_CLASS,
  TAB_META,
} from "./botFormUiConstants";
import { DEFAULT_WELCOME_MESSAGE, WelcomeMessagePreview, WELCOME_VARIABLES } from "./welcomeMessagePreview";

export function BehaviorSection() {
  const {
    categories,
    setCategories,
    customCategory,
    setCustomCategory,
    behaviorPreset,
    setBehaviorPreset,
    personality,
    setPersonality,
    behaviorText,
    setBehaviorText,
    thingsToAvoid,
    setThingsToAvoid,
    welcomeMessageEnabled,
    welcomeMessage,
    setWelcomeMessage,
    welcomeMessageInputRef,
    setWelcomeMessageEnabledWithDefault,
    insertWelcomeVariable,
    exampleQuestions,
    setExampleQuestions,
    leadCapture,
    setLeadCapture,
  } = useBotFormEditor();

  return (
    <div className={TAB_CONTENT_CLASS}>
      <SettingsPageHeader title={TAB_META.behavior.title} description={TAB_META.behavior.description} />
      <SettingsSectionCard
        title="Category"
        description="For organisation and behaviour context (e.g. support, sales). Not used as knowledge base content."
      >
        <div className="space-y-5">
          <SettingsFieldRow
            label="Presets"
            helperText="Pick one or more. Shown as tags when selected."
          >
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/30">
              <MultiSelect
                label="Options"
                subtitle="Click to toggle. Selected items appear as chips below."
                options={[...CATEGORY_OPTIONS]}
                value={categories}
                onChange={(next) => {
                  if (!customCategory.trim()) setCategories(next);
                }}
              />
              {categories.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {categories.map((v, i) => {
                    const opt = CATEGORY_OPTIONS.find((o) => o.value === v);
                    return (
                      <span
                        key={`category-${i}-${v}`}
                        className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-200/30 dark:text-brand-200"
                      >
                        {opt?.label ?? v}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Custom / other"
            htmlFor="bot-custom-category"
            helperText="Use when no preset matches."
            disabled={categories.length > 0}
            dependencyNote="Clear selected presets above to configure."
          >
            <Input
              id="bot-custom-category"
              value={customCategory}
              maxLength={BOT_FIELD_MAX.categoryText}
              disabled={categories.length > 0}
              onChange={(event) => {
                const next = event.target.value.slice(0, BOT_FIELD_MAX.categoryText);
                setCustomCategory(next);
                if (next.trim()) setCategories([]);
              }}
              placeholder="e.g. real-estate"
              className="w-full"
            />
          </SettingsFieldRow>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Personality"
        description="Define how the bot behaves and responds during conversations."
      >
        <div className="space-y-5">
          <SettingsFieldRow
            label="Preset"
            htmlFor="behavior-preset"
            helperText={
              behaviorPreset === "default"
                ? DEFAULT_PRESET_HELPER
                : "Adds a starter role; your instructions still extend or override details below."
            }
          >
            <select
              id="behavior-preset"
              value={behaviorPreset}
              onChange={(event) => setBehaviorPreset(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {BEHAVIOR_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Tone"
            htmlFor="behavior-tone"
            helperText="How the assistant sounds in replies—voice, warmth, and formality."
          >
            <select
              id="behavior-tone"
              value={personality.tone ?? "friendly"}
              onChange={(event) =>
                setPersonality((prev) => ({
                  ...prev,
                  tone: event.target.value as NonNullable<BotPersonality["tone"]>,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Instructions"
            htmlFor="behavior-description"
            helperText="What the assistant should do and how—merged into the system prompt with your preset."
            tooltip="Shown to the model as part of the system prompt."
          >
            <Textarea
              id="behavior-description"
              rows={4}
              value={behaviorText}
              maxLength={BOT_FIELD_MAX.personalityDescription}
              onChange={(event) =>
                setBehaviorText(event.target.value.slice(0, BOT_FIELD_MAX.personalityDescription))
              }
              className="w-full min-h-[6rem] resize-y"
            />
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Avoid instructions"
            htmlFor="things-to-avoid"
            helperText="Short red lines only—one idea per line is fine. Put detailed facts, policies, and FAQs in Knowledge, not here."
          >
            <Textarea
              id="things-to-avoid"
              rows={3}
              value={thingsToAvoid}
              maxLength={BOT_FIELD_MAX.thingsToAvoid}
              onChange={(event) => setThingsToAvoid(event.target.value.slice(0, BOT_FIELD_MAX.thingsToAvoid))}
              placeholder="e.g. medical advice, legal opinions, off-topic chat"
              className="w-full min-h-[4rem] resize-y"
            />
          </SettingsFieldRow>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="First Message Experience"
        description="Configure what users see when they first open the chat."
      >
        <div className="space-y-5">
          <SettingsToggleRow
            label="Welcome message"
            htmlFor="welcome-message-enabled"
            helperText="Show a custom message when the user opens the chat."
          >
            <input
              id="welcome-message-enabled"
              type="checkbox"
              checked={welcomeMessageEnabled}
              onChange={(e) => setWelcomeMessageEnabledWithDefault(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
            />
          </SettingsToggleRow>
          {welcomeMessageEnabled ? (
            <SettingsFieldRow
              label="Message text"
              htmlFor="welcome-message"
              helperText="Click a pill to insert that variable. Variables are highlighted in the preview below."
            >
              <div className="flex flex-col gap-2 w-full">
                <div className="flex flex-wrap gap-1.5">
                  {WELCOME_VARIABLES.map((v) => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => insertWelcomeVariable(v.value)}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 shadow-sm hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400 dark:hover:bg-gray-600/50"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  ref={welcomeMessageInputRef}
                  id="welcome-message"
                  rows={3}
                  value={welcomeMessage}
                  maxLength={BOT_FIELD_MAX.welcomeMessage}
                  onChange={(event) => setWelcomeMessage(event.target.value.slice(0, BOT_FIELD_MAX.welcomeMessage))}
                  placeholder={DEFAULT_WELCOME_MESSAGE}
                  className="w-full min-h-[5rem] resize-y"
                />
                {welcomeMessage.trim() ? (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Preview: <WelcomeMessagePreview text={welcomeMessage} />
                  </p>
                ) : null}
              </div>
            </SettingsFieldRow>
          ) : null}
          <SettingsFieldRow
            label="Suggested questions"
            helperText={`Quick conversation starters. ${exampleQuestions.length} of ${EXAMPLE_QUESTIONS_MAX}.`}
          >
            <div className="space-y-2">
              {exampleQuestions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 py-4 text-center text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
                  No suggested questions. Add one below.
                </p>
              ) : null}
              {exampleQuestions.map((q, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={q}
                    maxLength={BOT_FIELD_MAX.exampleQuestion}
                    onChange={(e) => {
                      const next = [...exampleQuestions];
                      next[index] = e.target.value.slice(0, BOT_FIELD_MAX.exampleQuestion);
                      setExampleQuestions(next);
                    }}
                    placeholder="e.g. What are your opening hours?"
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    onClick={() => setExampleQuestions(exampleQuestions.filter((_, i) => i !== index))}
                    aria-label="Remove question"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {exampleQuestions.length < EXAMPLE_QUESTIONS_MAX ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setExampleQuestions([...exampleQuestions, ""])}
                >
                  Add question
                </Button>
              ) : null}
            </div>
          </SettingsFieldRow>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Lead Capture"
        description="Collect contact details before sharing full answers. Enable below and add form fields."
      >
        <div className="space-y-4">
          <LeadCaptureEditor value={leadCapture} onChange={setLeadCapture} showFieldsWhenDisabled />
        </div>
      </SettingsSectionCard>
    </div>
  );
}
