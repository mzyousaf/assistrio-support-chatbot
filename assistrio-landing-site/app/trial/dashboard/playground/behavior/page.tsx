"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TrialEditorPane } from "@/components/trial/dashboard/trial-editor-pane";
import { TrialWorkspaceLoadingCenter } from "@/components/trial/dashboard/trial-workspace-loading-center";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { useTrialDashboardToast } from "@/components/trial/dashboard/trial-dashboard-toast";
import { trialFieldInputClass, trialFieldSelectClass, trialFieldTextareaClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";
import { TrialCategoryPills } from "@/components/trial/dashboard/trial-forms/trial-category-pills";
import { TrialSettingsPageHeader } from "@/components/trial/settings/trial-settings-page-header";
import { TrialSettingsSectionCard } from "@/components/trial/settings/trial-settings-section-card";
import { TrialSettingsFieldRow } from "@/components/trial/settings/trial-settings-field-row";
import { TrialSettingsToggleRow } from "@/components/trial/settings/trial-settings-toggle-row";
import {
  DEFAULT_WELCOME_MESSAGE,
  TRIAL_WELCOME_VARIABLES,
  TrialWelcomeMessagePreview,
} from "@/components/trial/playground/trial-welcome-message-preview";
import {
  fetchTrialWorkspaceAgent,
  patchTrialWorkspaceBehavior,
  patchTrialWorkspaceProfile,
  type TrialWorkspaceAgentPayload,
} from "@/lib/trial/trial-agent-workspace-api";
import {
  TRIAL_BEHAVIOR_EXAMPLE_QUESTIONS_MAX,
  TRIAL_BEHAVIOR_PRESETS,
  TRIAL_BEHAVIOR_TAB_META,
  TRIAL_BEHAVIOR_TONES,
} from "@/lib/trial/trial-behavior-ui-constants";
import { TRIAL_PROFILE_CATEGORIES } from "@/lib/trial/trial-workspace-draft";

const TAB_CONTENT_CLASS = "mx-auto w-full max-w-[min(1200px,100%)] space-y-8 pb-2";

const KNOWN_CATEGORY_IDS: Set<string> = new Set(TRIAL_PROFILE_CATEGORIES.map((c) => c.id));
const MAX_TRIAL_BEHAVIOR_CATEGORIES = 32;

export default function TrialPlaygroundBehaviorPage() {
  const router = useRouter();
  const { draft, hydrated } = useTrialWorkspaceDraft();
  const agentCtx = draft.trialAgent;
  const { showToast } = useTrialDashboardToast();
  const welcomeInputRef = useRef<HTMLTextAreaElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<TrialWorkspaceAgentPayload | null>(null);

  /** Kept in sync for save; edited on Profile tab — do not clear on behavior save. */
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [behaviorPreset, setBehaviorPreset] = useState("default");
  const [tone, setTone] = useState("friendly");
  const [thingsToAvoid, setThingsToAvoid] = useState("");

  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);

  const [leadEnabled, setLeadEnabled] = useState(false);
  const [leadStrategy, setLeadStrategy] = useState<"soft" | "balanced" | "direct">("balanced");

  const applyPayload = useCallback((p: TrialWorkspaceAgentPayload) => {
    setPayload(p);
    const b = p.behavior;
    const pr = p.profile;
    setShortDescription(b.shortDescription);
    setDescription(b.description);
    setSystemPrompt(b.personality.systemPrompt);
    setBehaviorPreset(b.personality.behaviorPreset || "default");
    setTone(b.personality.tone || "friendly");
    setThingsToAvoid(b.personality.thingsToAvoid ?? "");

    const fromProfile = pr.categories ?? [];
    const presetCats = fromProfile.filter((c) => KNOWN_CATEGORY_IDS.has(c));
    const unknown = fromProfile.filter((c) => !KNOWN_CATEGORY_IDS.has(c));
    if (presetCats.length > 0) {
      setCategories(presetCats);
      setCustomCategory("");
    } else if (unknown.length > 0) {
      setCategories([]);
      setCustomCategory(unknown[0]!.trim().slice(0, 64));
    } else {
      setCategories([]);
      setCustomCategory("");
    }

    const wm = b.welcomeMessage.trim();
    setWelcomeMessage(b.welcomeMessage);
    setWelcomeMessageEnabled(wm.length > 0);

    const qs = b.exampleQuestions.slice(0, TRIAL_BEHAVIOR_EXAMPLE_QUESTIONS_MAX);
    setExampleQuestions(qs.length ? qs : [""]);

    const lc = b.leadCapture as { enabled?: boolean; askStrategy?: string } | undefined;
    setLeadEnabled(lc?.enabled === true);
    const s = lc?.askStrategy;
    if (s === "soft" || s === "balanced" || s === "direct") setLeadStrategy(s);
    else setLeadStrategy("balanced");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchTrialWorkspaceAgent();
    setLoading(false);
    if (!res.ok) {
      showToast({ message: res.errorMessage, variant: "error" });
      return;
    }
    applyPayload(res);
  }, [applyPayload, showToast]);

  useEffect(() => {
    if (!hydrated) return;
    if (!agentCtx?.botId) {
      router.replace("/trial/dashboard/setup/go-live");
      return;
    }
    void load();
  }, [agentCtx?.botId, hydrated, load, router]);

  function setWelcomeMessageEnabledWithDefault(on: boolean) {
    if (on) {
      setWelcomeMessage((prev) => (prev.trim() ? prev : DEFAULT_WELCOME_MESSAGE));
      setWelcomeMessageEnabled(true);
    } else {
      setWelcomeMessageEnabled(false);
      setWelcomeMessage("");
    }
  }

  function insertWelcomeVariable(variable: string) {
    const el = welcomeInputRef.current;
    if (!el) {
      setWelcomeMessage((prev) => `${prev}${variable}`);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + variable + el.value.slice(end);
    setWelcomeMessage(next);
    window.requestAnimationFrame(() => {
      el.focus();
      const pos = start + variable.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function toggleCategory(id: string) {
    setCategories((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else if (set.size < MAX_TRIAL_BEHAVIOR_CATEGORIES) set.add(id);
      return TRIAL_PROFILE_CATEGORIES.map((c) => c.id).filter((x) => set.has(x));
    });
    setCustomCategory("");
  }

  function setQuestionAt(i: number, v: string) {
    setExampleQuestions((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  async function onSave() {
    setSaveMessage(null);
    if (!payload) return;

    const categoriesPayload = customCategory.trim()
      ? [customCategory.trim().slice(0, 64)]
      : categories;

    const questions = exampleQuestions.map((q) => q.trim()).filter(Boolean).slice(0, TRIAL_BEHAVIOR_EXAMPLE_QUESTIONS_MAX);

    setSaving(true);

    const profileRes = await patchTrialWorkspaceProfile({
      categories: categoriesPayload,
    });
    if (!profileRes.ok) {
      setSaving(false);
      showToast({ message: profileRes.errorMessage, variant: "error" });
      return;
    }
    applyPayload(profileRes);

    const behaviorRes = await patchTrialWorkspaceBehavior({
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      behaviorPreset,
      tone,
      thingsToAvoid: thingsToAvoid.trim(),
      welcomeMessage: welcomeMessageEnabled ? welcomeMessage.trim() : "",
      exampleQuestions: questions,
      leadCapture: {
        enabled: leadEnabled,
        askStrategy: leadStrategy,
      },
    });
    setSaving(false);

    if (!behaviorRes.ok) {
      showToast({ message: behaviorRes.errorMessage, variant: "error" });
      void load();
      return;
    }

    applyPayload(behaviorRes);
    setSaveMessage("Saved.");
    showToast({ message: "Behavior saved.", variant: "success" });
    window.setTimeout(() => setSaveMessage(null), 4000);
  }

  const lcFields = (payload?.behavior.leadCapture as { fields?: unknown[] } | undefined)?.fields;

  if (!hydrated) return null;
  if (!agentCtx?.botId) {
    return <TrialWorkspaceLoadingCenter variant="inline" message="Opening playground…" />;
  }

  if (loading || !payload) {
    return (
      <div className="mx-auto w-full max-w-[min(100%,48rem)] py-4">
        <TrialWorkspaceLoadingCenter variant="inline" message="Loading your agent…" />
      </div>
    );
  }

  return (
    <TrialEditorPane sectionTitle="Behavior" status="draft" saving={saving} formId="trial-behavior-form" saveMessage={saveMessage}>
      <form
        id="trial-behavior-form"
        className={`${TAB_CONTENT_CLASS} px-4 pt-2 sm:px-7 sm:pt-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <TrialSettingsPageHeader title={TRIAL_BEHAVIOR_TAB_META.title} description={TRIAL_BEHAVIOR_TAB_META.description} />

        <TrialSettingsSectionCard
          title="Category"
          description="For organisation and behaviour context (e.g. support, sales). Not used as knowledge base content."
        >
          <div className="space-y-5">
            <TrialSettingsFieldRow
              label="Presets"
              helperText="Pick one or more. Shown as tags when selected. Tagline and long description are edited on the Profile tab."
            >
              <div className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-3">
                <TrialCategoryPills
                  id="trial-behavior-cats"
                  categories={TRIAL_PROFILE_CATEGORIES}
                  selectedIds={categories}
                  onToggle={toggleCategory}
                  maxSelected={MAX_TRIAL_BEHAVIOR_CATEGORIES}
                  hideLabel
                />
              </div>
            </TrialSettingsFieldRow>
            <TrialSettingsFieldRow
              label="Custom / other"
              htmlFor="trial-behavior-custom-cat"
              helperText="Use when no preset matches."
              disabled={categories.length > 0}
              dependencyNote="Clear selected presets above to configure."
            >
              <input
                id="trial-behavior-custom-cat"
                className={trialFieldInputClass}
                value={customCategory}
                disabled={categories.length > 0}
                onChange={(e) => {
                  const next = e.target.value.slice(0, 64);
                  setCustomCategory(next);
                  if (next.trim()) setCategories([]);
                }}
                placeholder="e.g. real-estate"
              />
            </TrialSettingsFieldRow>
          </div>
        </TrialSettingsSectionCard>

        <TrialSettingsSectionCard
          title="Personality"
          description="Define how the agent behaves and responds during conversations."
        >
          <div className="space-y-5">
            <TrialSettingsFieldRow
              label="Preset"
              htmlFor="trial-behavior-preset"
              helperText="Base template; customize further with the description below."
            >
              <select
                id="trial-behavior-preset"
                className={trialFieldSelectClass}
                value={behaviorPreset}
                onChange={(e) => setBehaviorPreset(e.target.value)}
              >
                {TRIAL_BEHAVIOR_PRESETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </TrialSettingsFieldRow>
            <TrialSettingsFieldRow
              label="Tone"
              htmlFor="trial-behavior-tone"
              helperText="How the agent sounds in replies—including when it asks for contact details."
            >
              <select
                id="trial-behavior-tone"
                className={trialFieldSelectClass}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                {TRIAL_BEHAVIOR_TONES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </TrialSettingsFieldRow>
            <TrialSettingsFieldRow
              label="Description"
              htmlFor="trial-behavior-system"
              helperText="Additional system instructions that override or extend the preset. Shown to the model as part of the system prompt."
            >
              <textarea
                id="trial-behavior-system"
                rows={4}
                className={`${trialFieldTextareaClass} min-h-[6rem]`}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                maxLength={12000}
              />
            </TrialSettingsFieldRow>
            <TrialSettingsFieldRow
              label="Things to avoid"
              htmlFor="trial-behavior-avoid"
              helperText="Topics or behaviours the agent should not engage with. Shown to the model as behaviour context."
            >
              <textarea
                id="trial-behavior-avoid"
                rows={3}
                className={`${trialFieldTextareaClass} min-h-[4rem]`}
                value={thingsToAvoid}
                onChange={(e) => setThingsToAvoid(e.target.value)}
                placeholder="e.g. medical advice, legal opinions, off-topic chat"
                maxLength={4000}
              />
            </TrialSettingsFieldRow>
          </div>
        </TrialSettingsSectionCard>

        <TrialSettingsSectionCard
          title="First Message Experience"
          description="Configure what users see when they first open the chat."
        >
          <div className="space-y-5">
            <TrialSettingsToggleRow
              label="Welcome message"
              htmlFor="trial-welcome-enabled"
              helperText="Show a custom message when the user opens the chat."
              control={
                <input
                  id="trial-welcome-enabled"
                  type="checkbox"
                  checked={welcomeMessageEnabled}
                  onChange={(e) => setWelcomeMessageEnabledWithDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[var(--brand-teal)] focus:ring-[var(--brand-teal)]"
                />
              }
            />
            {welcomeMessageEnabled ? (
              <TrialSettingsFieldRow
                label="Message text"
                htmlFor="trial-welcome-body"
                helperText="Click a pill to insert that variable. Variables are highlighted in the preview below."
              >
                <div className="flex w-full flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {TRIAL_WELCOME_VARIABLES.map((v) => (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => insertWelcomeVariable(v.value)}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-100"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={welcomeInputRef}
                    id="trial-welcome-body"
                    rows={3}
                    className={`${trialFieldTextareaClass} min-h-[5rem]`}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder={DEFAULT_WELCOME_MESSAGE}
                    maxLength={2000}
                  />
                  {welcomeMessage.trim() ? (
                    <p className="text-[11px] text-slate-500">
                      Preview: <TrialWelcomeMessagePreview text={welcomeMessage} />
                    </p>
                  ) : null}
                </div>
              </TrialSettingsFieldRow>
            ) : null}
            <TrialSettingsFieldRow
              label="Suggested questions"
              helperText={`Quick conversation starters. ${exampleQuestions.filter((q) => q.trim()).length} of ${TRIAL_BEHAVIOR_EXAMPLE_QUESTIONS_MAX}.`}
            >
              <div className="space-y-2">
                {exampleQuestions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-4 text-center text-xs text-slate-500">
                    No suggested questions. Add one below.
                  </p>
                ) : null}
                {exampleQuestions.map((q, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      className={`${trialFieldInputClass} min-w-0 flex-1`}
                      value={q}
                      onChange={(e) => setQuestionAt(index, e.target.value)}
                      maxLength={500}
                      placeholder="e.g. What are your opening hours?"
                    />
                    <button
                      type="button"
                      className="shrink-0 text-[12px] font-semibold text-slate-500 hover:text-red-600"
                      onClick={() => {
                        const next = exampleQuestions.filter((_, j) => j !== index);
                        setExampleQuestions(next.length ? next : [""]);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {exampleQuestions.length < TRIAL_BEHAVIOR_EXAMPLE_QUESTIONS_MAX ? (
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-[var(--brand-teal-dark)] hover:underline"
                    onClick={() => setExampleQuestions([...exampleQuestions, ""])}
                  >
                    Add question
                  </button>
                ) : null}
              </div>
            </TrialSettingsFieldRow>
          </div>
        </TrialSettingsSectionCard>

        <TrialSettingsSectionCard
          title="Lead Capture"
          description="Collect contact details before sharing full answers. Trial workspace: enable capture, choose ask strategy, and review fields configured for your agent."
        >
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-800">
              <input
                type="checkbox"
                checked={leadEnabled}
                onChange={(e) => setLeadEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[var(--brand-teal)] focus:ring-[var(--brand-teal)]"
              />
              Enable lead capture
            </label>
            <TrialSettingsFieldRow label="Ask strategy" htmlFor="trial-lead-strategy">
              <select
                id="trial-lead-strategy"
                className={trialFieldSelectClass}
                value={leadStrategy}
                onChange={(e) => setLeadStrategy(e.target.value as typeof leadStrategy)}
              >
                <option value="soft">Soft</option>
                <option value="balanced">Balanced</option>
                <option value="direct">Direct</option>
              </select>
            </TrialSettingsFieldRow>
            <p className="text-[12px] leading-relaxed text-slate-500">
              Field definitions are not editable in the trial playground. They stay as created with your agent; use the full product to change fields.
            </p>
            {Array.isArray(lcFields) && lcFields.length > 0 ? (
              <ul className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-[12px] text-slate-600">
                {lcFields.map((f, i) => (
                  <li key={i}>
                    {typeof f === "object" && f && "label" in f ? String((f as { label?: string }).label) : "Field"} —{" "}
                    {typeof f === "object" && f && "key" in f ? String((f as { key?: string }).key) : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </TrialSettingsSectionCard>
      </form>
    </TrialEditorPane>
  );
}
