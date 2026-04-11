"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrialTextInput } from "@/components/trial/dashboard/trial-forms/trial-text-input";
import { StepInfoButton } from "@/components/trial/dashboard/trial-onboarding-stepper";
import {
  landingModalBackdropClass,
  landingModalCloseButtonClass,
  landingModalFooterBarClass,
  landingModalHeaderIconWrapClass,
  landingModalPanelClass,
} from "@/lib/landing-modal-styles";

const QUICK_LINK_URL_INFO =
  "Paste a full secure web address starting with https://. Visitors open it in a new tab when they tap this link in chat.";

type Props = {
  open: boolean;
  variant: "add" | "edit";
  initialLabel: string;
  initialUrl: string;
  onClose: () => void;
  onSave: (label: string, url: string) => void;
};

function isValidHttpsUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function TrialQuickLinkModal({ open, variant, initialLabel, initialUrl, onClose, onSave }: Props) {
  const titleId = useId();
  const descId = useId();
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(initialLabel);
  const [url, setUrl] = useState(initialUrl);
  const [urlError, setUrlError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setLabel(initialLabel);
      setUrl(initialUrl);
      setUrlError(undefined);
    }
  }, [open, initialLabel, initialUrl]);

  useLayoutEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => labelInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const labelOk = label.trim().length > 0;

  function trySave() {
    if (!label.trim()) return;
    if (!isValidHttpsUrl(url)) {
      setUrlError('Enter a valid https URL, e.g. "https://example.com".');
      return;
    }
    onSave(label.trim(), url.trim());
    onClose();
  }

  if (!open || typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex min-h-[100dvh] min-h-screen w-full items-center justify-center overflow-y-auto p-4 sm:p-6"
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <button
        type="button"
        aria-label="Close"
        className={`fixed inset-0 min-h-[100dvh] min-h-screen w-full ${landingModalBackdropClass}`}
        onClick={onClose}
      />
      <form
        className={`relative z-[1] my-auto min-h-0 w-full ${landingModalPanelClass}`}
        onSubmit={(e) => {
          e.preventDefault();
          trySave();
        }}
      >
        <div className="relative shrink-0 border-b border-slate-100/90 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <button
            type="button"
            onClick={onClose}
            className={`absolute right-3 top-3 z-[1] sm:right-4 sm:top-4 ${landingModalCloseButtonClass}`}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-10 sm:pr-11">
            <div className={landingModalHeaderIconWrapClass}>
              <Link2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-slate-900">
                {variant === "add" ? "Add quick link" : "Edit quick link"}
              </h2>
              <p id={descId} className="mt-1 text-[12px] leading-snug text-slate-500">
                Short label and full https URL — opens in a new tab from chat.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-5 py-5 sm:px-6">
          <TrialTextInput
            ref={labelInputRef}
            id="tw-ql-modal-label"
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Pricing"
            maxLength={80}
            autoComplete="off"
          />
          <TrialTextInput
            id="tw-ql-modal-url"
            label="URL"
            labelTrailing={<StepInfoButton label="URL" body={QUICK_LINK_URL_INFO} />}
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlError(undefined);
            }}
            placeholder="https://…"
            maxLength={500}
            autoComplete="off"
            error={urlError}
          />
        </div>

        <div className={`${landingModalFooterBarClass} flex flex-wrap justify-end gap-2`}>
          <Button type="button" variant="secondary" className="h-10 min-w-[5.5rem] rounded-[var(--radius-md)] px-4 text-[13px] font-semibold" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!labelOk} className="h-10 min-w-[5.5rem] rounded-[var(--radius-md)] px-5 text-[13px] font-semibold">
            Save
          </Button>
        </div>
      </form>
    </div>
  );

  return createPortal(modal, document.body);
}
