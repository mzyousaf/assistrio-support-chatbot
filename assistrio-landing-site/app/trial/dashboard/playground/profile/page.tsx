"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TrialEditorPane } from "@/components/trial/dashboard/trial-editor-pane";
import { TrialWorkspaceLoadingCenter } from "@/components/trial/dashboard/trial-workspace-loading-center";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { useTrialDashboardToast } from "@/components/trial/dashboard/trial-dashboard-toast";
import {
  trialFieldInputClass,
  trialFieldTextareaClass,
} from "@/components/trial/dashboard/trial-forms/trial-field-styles";
import { TrialSettingsPageHeader } from "@/components/trial/settings/trial-settings-page-header";
import { TrialSettingsSectionCard } from "@/components/trial/settings/trial-settings-section-card";
import { TrialSettingsGrid, TRIAL_SETTINGS_GRID_FULL } from "@/components/trial/settings/trial-settings-grid";
import { TrialSettingsFieldRow } from "@/components/trial/settings/trial-settings-field-row";
import { TrialSettingsInfoTooltip } from "@/components/trial/settings/trial-settings-info-tooltip";
import { TrialSettingsEmptyState } from "@/components/trial/settings/trial-settings-empty-state";
import {
  fetchTrialWorkspaceAgent,
  patchTrialWorkspaceProfile,
  patchTrialWorkspaceBehavior,
  type TrialWorkspaceAgentPayload,
} from "@/lib/trial/trial-agent-workspace-api";
import {
  isSafeImagePreviewSrc,
  TrialBrokenImagePlaceholder,
} from "@/lib/trial/trial-image-preview-utils";
import { isTrialHostedAvatarObjectUrl } from "@/lib/trial/trial-hosted-avatar-url";
import { TRIAL_MAX_AVATAR_FILE_BYTES } from "@/lib/trial/trial-knowledge-limits";
import { uploadTrialOnboardingAsset } from "@/lib/trial/trial-onboarding-upload";
import { mergeAvatarAssetServerResponseIntoDraft } from "@/lib/trial/trial-asset-draft-merge";

const TAB_CONTENT_CLASS = "mx-auto w-full max-w-[min(1200px,100%)] space-y-8 pb-2";

const IDENTITY_VISIBILITY_TITLE = "Identity & visibility";
const IDENTITY_VISIBILITY_DESCRIPTION =
  "Name, avatar, descriptions, and how the agent appears to visitors. Changes apply to your live trial agent in the playground.";

function cx(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(" ");
}

export default function TrialPlaygroundProfilePage() {
  const router = useRouter();
  const { draft, hydrated, replaceDraft } = useTrialWorkspaceDraft();
  const agentCtx = draft.trialAgent;
  const { showToast } = useTrialDashboardToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<TrialWorkspaceAgentPayload | null>(null);

  const [name, setName] = useState("");
  const [includeNameInKnowledge, setIncludeNameInKnowledge] = useState(false);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");

  /** User-entered external image URL only (not Assistrio-hosted trial avatar object URLs). */
  const [userImageUrl, setUserImageUrl] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const applyPayload = useCallback((p: TrialWorkspaceAgentPayload) => {
    setPayload(p);
    const pr = p.profile;
    const b = p.behavior;
    setName(pr.name);
    setIncludeNameInKnowledge(pr.includeNameInKnowledge ?? false);
    setShortDescription(b.shortDescription);
    setDescription(b.description);
    const img = pr.imageUrl.trim();
    if (img && !isTrialHostedAvatarObjectUrl(img)) {
      setUserImageUrl(img);
    } else {
      setUserImageUrl("");
    }
    setAvatarEmoji(pr.avatarEmoji ?? "");
    setAvatarPreviewFailed(false);
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

  const serverAvatarUrl = payload?.profile.imageUrl.trim() ?? "";
  const previewSrc = (userImageUrl.trim() || serverAvatarUrl).trim();
  const previewSafe = Boolean(previewSrc && isSafeImagePreviewSrc(previewSrc));
  const showImagePreview = previewSafe && !avatarPreviewFailed;
  const showBrokenUrlPreview = previewSafe && avatarPreviewFailed;
  const showEmojiPreview = !previewSafe && avatarEmoji.trim().length > 0;
  const canRemoveImage = previewSrc.length > 0;

  const hasImageUrl = userImageUrl.trim().length > 0;
  const hasImageFile =
    Boolean(serverAvatarUrl) && isTrialHostedAvatarObjectUrl(serverAvatarUrl) && !hasImageUrl;

  const applyAvatarFile = useCallback(
    async (file: File | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      if (file.size > TRIAL_MAX_AVATAR_FILE_BYTES) {
        showToast({ message: "Avatar must be 2MB or smaller.", variant: "error" });
        return;
      }
      const okMime = /^image\/(jpeg|png|webp)$/i.test(file.type);
      if (!okMime) {
        showToast({ message: "Use a PNG, JPG, or WebP image.", variant: "error" });
        return;
      }
      setUploadBusy(true);
      try {
        const { draft: raw } = await uploadTrialOnboardingAsset("avatar", file);
        replaceDraft((prev) => mergeAvatarAssetServerResponseIntoDraft(prev, raw));
        await load();
        showToast({ message: "Avatar uploaded.", variant: "success" });
        if (fileRef.current) fileRef.current.value = "";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        showToast({ message: msg, variant: "error" });
      } finally {
        setUploadBusy(false);
        setDragOver(false);
      }
    },
    [load, replaceDraft, showToast],
  );

  async function removeAvatarImage() {
    setUploadBusy(true);
    try {
      const res = await patchTrialWorkspaceProfile({ imageUrl: "" });
      if (!res.ok) {
        showToast({ message: res.errorMessage, variant: "error" });
        return;
      }
      applyPayload(res);
      setAvatarPreviewFailed(false);
      showToast({ message: "Avatar removed.", variant: "success" });
    } finally {
      setUploadBusy(false);
    }
  }

  async function onSave() {
    setSaveMessage(null);
    const n = name.trim();
    const sd = shortDescription.trim();
    const desc = description.trim();
    if (!n) {
      showToast({ message: "Agent name is required.", variant: "error" });
      return;
    }
    if (!desc) {
      showToast({ message: "Description is required.", variant: "error" });
      return;
    }

    const profilePatch: Record<string, unknown> = {
      name: n,
      includeNameInKnowledge,
      avatarEmoji: avatarEmoji.trim().slice(0, 12),
    };
    const u = userImageUrl.trim();
    const serverAv = payload?.profile.imageUrl.trim() ?? "";
    if (u) {
      profilePatch.imageUrl = u;
    } else if (serverAv && !isTrialHostedAvatarObjectUrl(serverAv)) {
      profilePatch.imageUrl = "";
    }

    setSaving(true);
    const profileRes = await patchTrialWorkspaceProfile(profilePatch);

    if (!profileRes.ok) {
      setSaving(false);
      showToast({ message: profileRes.errorMessage, variant: "error" });
      return;
    }

    applyPayload(profileRes);

    const behaviorRes = await patchTrialWorkspaceBehavior({
      shortDescription: sd,
      description: desc,
    });
    setSaving(false);

    if (!behaviorRes.ok) {
      showToast({ message: behaviorRes.errorMessage, variant: "error" });
      void load();
      return;
    }

    applyPayload(behaviorRes);
    setSaveMessage("Saved.");
    showToast({ message: "Profile saved.", variant: "success" });
    window.setTimeout(() => setSaveMessage(null), 4000);
  }

  if (!hydrated) return null;
  if (!agentCtx?.botId) {
    return <TrialWorkspaceLoadingCenter variant="inline" message="Opening playground…" />;
  }

  if (loading || !payload) {
    return (
      <div className="mx-auto w-full max-w-[min(100%,42rem)] py-4">
        <TrialWorkspaceLoadingCenter variant="inline" message="Loading your agent…" />
      </div>
    );
  }

  return (
    <TrialEditorPane
      sectionTitle="Profile"
      status="draft"
      saving={saving}
      formId="trial-profile-form"
      saveMessage={saveMessage}
    >
      <form
        id="trial-profile-form"
        className={`${TAB_CONTENT_CLASS} px-4 pt-2 sm:px-7 sm:pt-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <TrialSettingsPageHeader title={IDENTITY_VISIBILITY_TITLE} description={IDENTITY_VISIBILITY_DESCRIPTION} />

        <TrialSettingsSectionCard
          title="Identity"
          description="Define the agent&apos;s basic identity used across the trial workspace."
        >
          <TrialSettingsGrid>
            <TrialSettingsFieldRow
              label="Agent name"
              htmlFor="trial-agent-name"
              required
              helperText="Display name used in listings, chat header, and across the workspace."
            >
              <div className="flex w-full flex-col gap-2">
                <input
                  id="trial-agent-name"
                  className={trialFieldInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  autoComplete="off"
                  required
                />
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={includeNameInKnowledge}
                    onChange={(e) => setIncludeNameInKnowledge(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--brand-teal)] focus:ring-[var(--brand-teal)]"
                  />
                  <span>Include in knowledge base</span>
                  <TrialSettingsInfoTooltip
                    content="When enabled, the agent name above is included in the knowledge layer and takes precedence over other names mentioned in context."
                    className="ml-0.5"
                  />
                </label>
              </div>
            </TrialSettingsFieldRow>

            <TrialSettingsFieldRow
              label="Tagline"
              htmlFor="trial-agent-tagline"
              helperText="Short headline shown in listings and chat header."
            >
              <input
                id="trial-agent-tagline"
                type="text"
                className={trialFieldInputClass}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="e.g. Your 24/7 support assistant"
                maxLength={500}
              />
            </TrialSettingsFieldRow>

            <div className={TRIAL_SETTINGS_GRID_FULL}>
              <TrialSettingsFieldRow
                label="Description"
                htmlFor="trial-agent-description"
                required
                helperText="Main public description shown to users."
              >
                <textarea
                  id="trial-agent-description"
                  rows={4}
                  className={`${trialFieldTextareaClass} min-h-[6rem]`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </TrialSettingsFieldRow>
            </div>
          </TrialSettingsGrid>
        </TrialSettingsSectionCard>

        <TrialSettingsSectionCard title="Avatar" description="Upload or provide a visual avatar for the agent.">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <div className="flex flex-col">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Agent avatar preview</p>
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50">
                {showImagePreview ? (
                  <div className="relative p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc}
                      alt=""
                      width={120}
                      height={120}
                      className="h-[120px] w-[120px] rounded-xl border border-slate-200 object-cover shadow-sm"
                      onError={() => setAvatarPreviewFailed(true)}
                    />
                    {canRemoveImage ? (
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                        disabled={uploadBusy}
                        onClick={() => void removeAvatarImage()}
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>
                ) : showBrokenUrlPreview ? (
                  <div className="relative p-4">
                    <TrialBrokenImagePlaceholder
                      subtitle="Couldn’t load this image. Check the URL or try another link."
                    />
                    {canRemoveImage ? (
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                        disabled={uploadBusy}
                        onClick={() => void removeAvatarImage()}
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>
                ) : showEmojiPreview ? (
                  <div className="flex min-h-[160px] flex-col items-center justify-center p-4">
                    <span className="text-7xl leading-none" aria-hidden>
                      {avatarEmoji.trim()}
                    </span>
                    <p className="mt-3 text-xs text-slate-500">Emoji avatar (no image)</p>
                  </div>
                ) : (
                  <TrialSettingsEmptyState
                    title="No image"
                    description="Enter a URL, upload a file, or set an emoji below."
                    className="min-h-[180px] border-0 bg-transparent py-8"
                  />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <TrialSettingsFieldRow
                label="Image URL"
                htmlFor="trial-agent-image-url"
                dependencyNote={
                  hasImageFile ? "Remove the uploaded file to configure this setting." : undefined
                }
              >
                <input
                  id="trial-agent-image-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  className={cx(trialFieldInputClass, hasImageFile && "cursor-not-allowed opacity-70")}
                  value={userImageUrl}
                  disabled={hasImageFile}
                  onChange={(e) => {
                    setUserImageUrl(e.target.value);
                    setAvatarPreviewFailed(false);
                  }}
                  placeholder="https://i.pravatar.cc/150?img=3"
                  maxLength={2000}
                />
              </TrialSettingsFieldRow>

              <TrialSettingsFieldRow
                label="Or emoji avatar"
                htmlFor="trial-agent-emoji"
                helperText="Used when no image is set (e.g. one emoji). Max 12 characters."
              >
                <input
                  id="trial-agent-emoji"
                  className={`${trialFieldInputClass} max-w-xs`}
                  value={avatarEmoji}
                  onChange={(e) => setAvatarEmoji(e.target.value.slice(0, 12))}
                  placeholder={"e.g. \u{1F916}"}
                  maxLength={12}
                />
              </TrialSettingsFieldRow>

              <TrialSettingsFieldRow
                label="Or upload file"
                htmlFor="trial-agent-avatar-file"
                helperText="PNG, JPG, or WEBP. Max 2MB."
                dependencyNote={hasImageUrl ? "Clear the image URL above to configure this setting." : undefined}
              >
                <input
                  ref={fileRef}
                  id="trial-agent-avatar-file"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={hasImageUrl || uploadBusy}
                  onChange={(e) => void applyAvatarFile(e.target.files?.[0] ?? null)}
                />
                <div
                  role="button"
                  tabIndex={hasImageUrl || uploadBusy ? -1 : 0}
                  onKeyDown={(e) => {
                    if (hasImageUrl || uploadBusy) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileRef.current?.click();
                    }
                  }}
                  onClick={() => {
                    if (!hasImageUrl && !uploadBusy) fileRef.current?.click();
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (!hasImageUrl && !uploadBusy) setDragOver(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!hasImageUrl && !uploadBusy) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (hasImageUrl || uploadBusy) return;
                    const f = e.dataTransfer.files?.[0];
                    void applyAvatarFile(f ?? null);
                  }}
                  className={cx(
                    "cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition",
                    hasImageUrl || uploadBusy
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : dragOver
                        ? "border-[var(--brand-teal)] bg-[var(--brand-teal-faint)]/40"
                        : "border-slate-300 bg-slate-50 hover:border-slate-400",
                  )}
                >
                  <span className="text-sm text-slate-600">
                    {uploadBusy ? "Uploading…" : "Drag & drop here or click to browse"}
                  </span>
                </div>
              </TrialSettingsFieldRow>
            </div>
          </div>
        </TrialSettingsSectionCard>
      </form>
    </TrialEditorPane>
  );
}
