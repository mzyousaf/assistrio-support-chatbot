"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { trialImageFileToDataUrl } from "@/lib/trial/trial-image-file-to-data-url";
import { TrialUploadField } from "@/components/trial/dashboard/trial-forms/trial-upload-field";
import { trialFieldInputClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";
import { Trash2 } from "lucide-react";
import { StepInfoButton } from "@/components/trial/dashboard/trial-onboarding-stepper";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { mergeAvatarAssetServerResponseIntoDraft } from "@/lib/trial/trial-asset-draft-merge";
import { uploadTrialOnboardingAsset } from "@/lib/trial/trial-onboarding-upload";
import { useTrialDashboardToast } from "@/components/trial/dashboard/trial-dashboard-toast";

type Props = {
  /** Latest resolved image URL (upload vs external URL by timestamp). */
  resolvedAvatarUrl: string;
  /** Value for the “Use image URL instead” field only — never an Assistrio upload URL. */
  userExternalAvatarUrl: string;
  onUserExternalAvatarUrlChange: (url: string) => void;
  /** When S3 upload fails, store a local data URL for preview until the user retries. */
  onLocalFallbackDataUrl?: (dataUrl: string) => void;
  urlInputId?: string;
  urlMaxLength?: number;
};

const AVATAR_COPY =
  "Square photos look best in the widget header. Use a clear logo or headshot with good contrast—those read best when the avatar is small in the chat bar.";

const IMAGE_URL_TOOLTIP = "Paste a public HTTPS URL. This field only stores what you type here—it does not show uploaded files.";

/** Optional field: empty is valid; otherwise must be a parseable http(s) URL. */
function validateOptionalImageUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "Use a URL that starts with http:// or https://.";
    }
    return undefined;
  } catch {
    return "Enter a valid image URL (for example https://example.com/photo.jpg).";
  }
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
      />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l4-4m-4 4L8 8"
      />
    </svg>
  );
}

export function TrialAvatarUpload({
  resolvedAvatarUrl,
  userExternalAvatarUrl,
  onUserExternalAvatarUrlChange,
  onLocalFallbackDataUrl,
  urlInputId = "tw-avatar-url",
  urlMaxLength = 500,
}: Props) {
  const { draft, replaceDraft } = useTrialWorkspaceDraft();
  const { showToast } = useTrialDashboardToast();
  const baseId = useId();
  const fileInputId = `${baseId}-avatar-file`;
  const dropId = `${baseId}-avatar-drop`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showUrl, setShowUrl] = useState(
    () => /^https?:\/\//i.test(userExternalAvatarUrl.trim()) && userExternalAvatarUrl.trim().length > 0,
  );

  useEffect(() => {
    if (userExternalAvatarUrl.trim().length > 0) setShowUrl(true);
  }, [userExternalAvatarUrl]);

  const hasPreview = resolvedAvatarUrl.trim().length > 0;
  const isDataUrl = resolvedAvatarUrl.startsWith("data:image/");
  const hasUploadedAvatar = (draft.uploadedAssets ?? []).some((a) => a.kind === "avatar");
  const imageUrlError = validateOptionalImageUrl(userExternalAvatarUrl);
  const imageUrlErrorId = `${urlInputId}-error`;

  const applyFile = useCallback(
    async (file: File | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      setBusy(true);
      try {
        const { draft: raw } = await uploadTrialOnboardingAsset("avatar", file);
        replaceDraft((prev) => mergeAvatarAssetServerResponseIntoDraft(prev, raw));
        setDragOver(false);
        if (fileRef.current) {
          fileRef.current.value = "";
        }
        showToast({ message: "Avatar saved to your workspace.", variant: "success" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        showToast({ message: msg, variant: "error" });
        try {
          const dataUrl = await trialImageFileToDataUrl(file);
          onLocalFallbackDataUrl?.(dataUrl);
        } catch {
          /* ignore */
        }
      } finally {
        setBusy(false);
      }
    },
    [onLocalFallbackDataUrl, replaceDraft, showToast],
  );

  const clearAvatar = useCallback(async () => {
    setBusy(true);
    try {
      const nextAssets = (draft.uploadedAssets ?? []).filter((a) => a.kind !== "avatar");
      const res = await fetch("/api/trial/draft", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          profile: { avatarByUpload: null },
          uploadedAssets: nextAssets,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && j.ok === true && j.draft != null) {
        replaceDraft((prev) => mergeAvatarAssetServerResponseIntoDraft(prev, j.draft));
        if (fileRef.current) {
          fileRef.current.value = "";
        }
        setDragOver(false);
      } else {
        const msg = typeof j.error === "string" && j.error.trim() ? j.error.trim() : "Could not remove avatar.";
        showToast({ message: msg, variant: "error" });
      }
    } catch {
      showToast({ message: "Could not remove avatar.", variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [draft.uploadedAssets, replaceDraft, showToast]);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      void applyFile(f ?? null);
    },
    [applyFile],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <div className="relative w-full max-w-[15rem]">
          <TrialUploadField
            id={dropId}
            inputId={fileInputId}
            inputRef={fileRef}
            label="Upload avatar image"
            description="Choose a PNG, JPG, or GIF. Files are stored in your workspace on our servers."
            onFileChange={(f) => void applyFile(f)}
          >
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={[
                "group flex min-h-[11rem] w-full flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed bg-gradient-to-b from-white to-slate-50/95 px-4 py-6 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.98),0_1px_0_0_rgba(15,23,42,0.04)] transition duration-200",
                dragOver
                  ? "border-[var(--brand-teal)]/70 bg-[var(--brand-teal-faint)]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_0_0_2px_rgba(13,148,136,0.22)]"
                  : "border-slate-300/90 hover:border-slate-400 hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)]",
                busy && "pointer-events-none opacity-60",
              ].join(" ")}
            >
              <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-sm bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
                {hasPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolvedAvatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400/95">
                    <IconUser className="h-12 w-12 opacity-90" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <span className="flex items-center justify-center gap-2 text-[13px] font-medium text-slate-800">
                  <IconUpload className="h-4 w-4 shrink-0 text-[var(--brand-teal)]" />
                  {hasPreview ? "Replace image" : "Upload image"}
                </span>
                <span className="block text-[11px] font-medium leading-snug text-slate-500/85">Drop a file here or click to browse</span>
              </div>
            </div>
          </TrialUploadField>
          {hasUploadedAvatar ? (
            <button
              type="button"
              aria-label="Remove uploaded image"
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200/95 bg-white/95 text-slate-600 shadow-sm backdrop-blur-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => void clearAvatar()}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <p className="text-[13px] font-medium text-slate-700">Avatar</p>
          <p className="text-[11px] leading-relaxed text-slate-500">{AVATAR_COPY}</p>
          {hasPreview && isDataUrl ? (
            <p className="text-[10px] leading-snug text-slate-500/75">Local preview — upload again to save to your workspace.</p>
          ) : null}

          {showUrl ? (
            <div className="mt-4 space-y-1.5 border-t border-slate-200/70 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <label
                    htmlFor={urlInputId}
                    className={[
                      "mb-0 cursor-pointer text-[11px] font-medium",
                      imageUrlError ? "text-red-700" : "text-slate-500",
                    ].join(" ")}
                  >
                    Image URL <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <StepInfoButton label="Image URL" body={IMAGE_URL_TOOLTIP} />
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-medium text-[var(--brand-teal-dark)]/90 underline-offset-2 hover:underline"
                  onClick={() => setShowUrl(false)}
                >
                  Hide image URL
                </button>
              </div>
              <input
                id={urlInputId}
                type="url"
                className={[
                  trialFieldInputClass,
                  "text-[0.8125rem] bg-slate-50/40",
                  imageUrlError
                    ? "border-red-500/90 focus:border-red-600 focus:shadow-[inset_0_0_0_1px_rgba(220,38,38,0.25),0_0_0_2px_rgba(220,38,38,0.15)] focus:ring-0"
                    : "border-slate-300/90",
                ].join(" ")}
                value={userExternalAvatarUrl}
                onChange={(e) => onUserExternalAvatarUrlChange(e.target.value)}
                placeholder="https://…"
                maxLength={urlMaxLength}
                autoComplete="off"
                aria-invalid={imageUrlError ? true : undefined}
                aria-describedby={imageUrlError ? imageUrlErrorId : undefined}
              />
              {imageUrlError ? (
                <p id={imageUrlErrorId} className="mt-0.5 text-[12px] font-medium text-red-600" role="alert">
                  {imageUrlError}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 border-t border-slate-200/70 pt-3">
              <p className="text-[12px] leading-snug text-slate-600">
                Prefer a hosted image?{" "}
                <button
                  type="button"
                  className="inline border-0 bg-transparent p-0 text-left font-medium text-[var(--brand-teal)] underline decoration-[var(--brand-teal)]/35 underline-offset-[3px] transition hover:text-[var(--brand-teal-dark)] hover:decoration-[var(--brand-teal-dark)]/50"
                  onClick={() => setShowUrl(true)}
                >
                  Use image URL instead
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
