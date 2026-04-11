"use client";

import { useMemo, useRef } from "react";
import { TrialFormSection } from "@/components/trial/dashboard/trial-forms/trial-form-section";
import { TrialCategoryPills } from "@/components/trial/dashboard/trial-forms/trial-category-pills";
import { TrialSetupSectionHeader } from "@/components/trial/dashboard/trial-setup-section-header";
import { StepInfoButton } from "@/components/trial/dashboard/trial-onboarding-stepper";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { TrialAvatarUpload } from "@/components/trial/dashboard/trial-forms/trial-avatar-upload";
import { TrialColorInput } from "@/components/trial/dashboard/trial-forms/trial-color-input";
import {
  TrialQuickLinksEditor,
  type TrialQuickLinksEditorHandle,
} from "@/components/trial/dashboard/trial-forms/trial-quick-links-editor";
import { TrialTextInput } from "@/components/trial/dashboard/trial-forms/trial-text-input";
import { Button } from "@/components/ui/button";
import {
  getTrialSetupStepConfig,
  isValidProfileBrandColor,
  resolveFinalAvatarUrl,
  TRIAL_PROFILE_CATEGORIES,
  type TrialProfileQuickLink,
} from "@/lib/trial/trial-workspace-draft";

function newQuickLinkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ql-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const quickLinksInfoBody =
  "Shortcuts show up in chat so visitors can open important pages in one tap—pricing, booking, docs, or anything you link often.";

const MAX_CATEGORIES = 3;

export function TrialProfileStepBody() {
  const { draft, setProfile } = useTrialWorkspaceDraft();
  const p = draft.profile;
  const section = getTrialSetupStepConfig("profile");
  const quickLinksRef = useRef<TrialQuickLinksEditorHandle>(null);

  function createQuickLink(label: string, url: string) {
    if (p.quickLinks.length >= 8) return;
    const row: TrialProfileQuickLink = { id: newQuickLinkId(), label, url };
    setProfile({ quickLinks: [...p.quickLinks, row] });
  }

  function updateQuickLink(id: string, label: string, url: string) {
    setProfile({
      quickLinks: p.quickLinks.map((q) => (q.id === id ? { ...q, label, url } : q)),
    });
  }

  function removeQuickLink(id: string) {
    setProfile({ quickLinks: p.quickLinks.filter((q) => q.id !== id) });
  }

  function toggleCategory(categoryId: string) {
    const set = new Set(p.categories);
    if (set.has(categoryId)) {
      if (set.size <= 1) return;
      set.delete(categoryId);
    } else {
      if (set.size >= MAX_CATEGORIES) return;
      set.add(categoryId);
    }
    const ordered = TRIAL_PROFILE_CATEGORIES.map((c) => c.id).filter((id) => set.has(id));
    setProfile({ categories: ordered });
  }

  const colorPickerValue =
    p.brandColor?.startsWith("#") && p.brandColor.length >= 4 ? p.brandColor : "#0d9488";

  const categoryHint = useMemo(() => {
    const base = "Pick one or more that fit. At least one must stay selected.";
    const selected = p.categories
      .map((id) => TRIAL_PROFILE_CATEGORIES.find((c) => c.id === id))
      .filter((c): c is (typeof TRIAL_PROFILE_CATEGORIES)[number] => !!c);
    if (selected.length === 0) {
      return `${base} Categories help us tune greetings and suggestions to match how you work.`;
    }
    if (selected.length === 1) {
      const c = selected[0];
      return `${base} We’ll lean toward ${c.title.toLowerCase()}-style conversations—${c.description}`;
    }
    const names = selected.map((c) => c.title);
    const blended = selected.map((c) => c.description.replace(/\.$/, "")).join(" · ");
    return `${base} Together, ${names.join(" + ")} shape the tone of suggestions across ${blended}.`;
  }, [p.categories]);

  const addQuickLinkDisabled = p.quickLinks.length >= 8;

  const brandColorError = !isValidProfileBrandColor(p.brandColor)
    ? p.brandColor.trim() === ""
      ? "Brand color is required."
      : "Enter a valid hex color (e.g. #0d9488)."
    : undefined;

  return (
    <div className="space-y-10 pb-2">
      <TrialSetupSectionHeader
        compactBottom
        title={section.editorTitle}
        description={section.editorDescription}
        trailing={<StepInfoButton label={section.editorTitle} body={section.infoBody} />}
      />

      <TrialFormSection
        title="Name & branding"
        description="Choose how your AI Agent introduces itself—display name, categories that fit, and a brand color people will notice."
      >
        <div className="flex w-full flex-col gap-8">
          <div className="grid gap-7 sm:grid-cols-2 sm:items-start sm:gap-x-10 sm:gap-y-6">
            <div className="min-w-0">
              <TrialTextInput
                id="tw-agent-name"
                label={
                  <>
                    AI Agent name <span className="text-red-600">*</span>
                  </>
                }
                value={p.agentName}
                onChange={(e) => setProfile({ agentName: e.target.value })}
                placeholder="e.g. Riley from Acme Support"
                maxLength={120}
                autoComplete="off"
                hint="Shown at the top of the chat so visitors know which AI Agent they’re talking to."
              />
            </div>
            <div className="min-w-0">
              <TrialColorInput
                id="tw-brand-color-hex"
                label={
                  <>
                    Brand Color <span className="text-red-600">*</span>
                  </>
                }
                colorValue={colorPickerValue}
                textValue={p.brandColor}
                onColorChange={(hex) => setProfile({ brandColor: hex })}
                onTextChange={(hex) => setProfile({ brandColor: hex })}
                hint="Accent color visitors see around your AI Agent in chat."
                error={brandColorError}
              />
            </div>
          </div>

          <TrialCategoryPills
            id="tw-category"
            selectedIds={p.categories}
            onToggle={toggleCategory}
            categories={TRIAL_PROFILE_CATEGORIES}
            hint={categoryHint}
            maxSelected={MAX_CATEGORIES}
          />
        </div>
      </TrialFormSection>

      <section className="space-y-4">
        <TrialAvatarUpload
          resolvedAvatarUrl={resolveFinalAvatarUrl(p)}
          userExternalAvatarUrl={p.avatarByUserURL != null ? p.avatarByUserURL.url : ""}
          onUserExternalAvatarUrlChange={(url) => {
            const iso = new Date().toISOString();
            setProfile({
              avatarByUserURL: url.trim() ? { url: url.trim().slice(0, 500), updatedAt: iso } : null,
            });
          }}
          onLocalFallbackDataUrl={(dataUrl) => setProfile({ avatarUrl: dataUrl })}
          urlInputId="tw-avatar-url"
        />
      </section>

      <TrialFormSection
        title="Quick links"
        description="Handy shortcuts you want one tap away—pricing, docs, booking, and more."
        trailing={<StepInfoButton label="Quick Links" body={quickLinksInfoBody} />}
        headerEnd={
          <Button
            type="button"
            variant="secondary"
            className="h-9 w-full rounded-sm px-3.5 text-[13px] sm:w-auto"
            disabled={addQuickLinkDisabled}
            onClick={() => quickLinksRef.current?.openAdd()}
          >
            Add Quick Link
          </Button>
        }
      >
        <TrialQuickLinksEditor
          ref={quickLinksRef}
          embedded
          showAddButton={false}
          links={p.quickLinks}
          onCreate={createQuickLink}
          onUpdate={updateQuickLink}
          onRemove={removeQuickLink}
          maxLinks={8}
        />
      </TrialFormSection>
    </div>
  );
}
