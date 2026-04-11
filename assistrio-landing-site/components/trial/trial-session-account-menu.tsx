"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import type { TrialSessionClientPayload } from "@/lib/trial/trial-session-display";
import { GALLERY_CTA_NAV_LABEL } from "@/lib/trial-primary-cta-label";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35 focus-visible:ring-offset-2";

const menuRowNeutral =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50";

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500" aria-hidden>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
      />
    </svg>
  );
}

function IconGallery() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconLayout() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--brand-teal-dark)]" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
      />
    </svg>
  );
}

type Props = {
  session: TrialSessionClientPayload;
  /** Marketing header: Workspace + gallery + trial. Dashboard: Assistrio Landing + gallery + trial. */
  variant?: "header" | "dashboard";
};

/**
 * Shared account control — menu contents depend on {@link variant}.
 */
export function TrialSessionAccountMenu({ session, variant = "header" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { track } = useTrackEvent();

  const menuZ = variant === "dashboard" ? "z-[70]" : "z-50";
  const trackLocation = variant === "header" ? "site_header_account" : "trial_shell_account";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        title={session.displayName}
        className={`flex h-9 max-h-[36px] min-h-0 max-w-full items-center gap-1.5 rounded-md bg-transparent py-0 pl-1 pr-1 transition hover:bg-slate-50/80 sm:gap-2 sm:pl-1.5 sm:pr-2 ${focusRing}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="hidden min-w-0 flex-1 flex-col items-end justify-center min-[380px]:flex">
          <div className="w-full min-w-0 max-w-[10rem] sm:max-w-[12rem]">
            <span className="block w-full truncate text-right text-[12px] font-medium leading-tight text-slate-900 sm:text-[13px]">
              {session.displayName}
            </span>
            {session.workspaceIdLabel ? (
              <span className="mt-0.5 block w-full truncate text-right font-mono text-[10px] leading-tight text-slate-500 tabular-nums sm:text-[11px]">
                {session.workspaceIdLabel}
              </span>
            ) : null}
          </div>
        </div>
        <IconChevron open={open} />
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal)] text-xs font-semibold tabular-nums leading-none text-white"
          aria-hidden
        >
          {session.initials}
        </span>
        <span className="sr-only">Account menu</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute right-0 ${menuZ} mt-2 w-[min(18.5rem,calc(100vw-1rem))] origin-top-right overflow-hidden rounded-lg border border-[var(--border-default)] bg-white py-1 shadow-[var(--shadow-md)]`}
        >
          <div className="min-w-0 border-b border-slate-100 px-3 pb-3 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Account</p>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-slate-900">{session.displayName}</p>
            {session.workspaceIdLabel ? (
              <p className="mt-1 truncate font-mono text-[12px] leading-snug tabular-nums text-slate-600" title={session.workspaceIdLabel}>
                {session.workspaceIdLabel}
              </p>
            ) : null}
            {session.emailNormalized ? (
              <p className="mt-1 break-all text-[12px] leading-snug text-slate-600">{session.emailNormalized}</p>
            ) : null}
          </div>

          <div className="p-1">
            {variant === "dashboard" ? (
              <>
                <Link
                  role="menuitem"
                  href="/"
                  className={menuRowNeutral}
                  onClick={() => {
                    setOpen(false);
                    track("cta_clicked", { location: trackLocation, label: "Assistrio Landing", href: "/" });
                  }}
                >
                  <IconHome />
                  Assistrio Landing
                </Link>
                <Link
                  role="menuitem"
                  href="/gallery"
                  className={menuRowNeutral}
                  onClick={() => {
                    setOpen(false);
                    track("cta_clicked", {
                      location: trackLocation,
                      label: GALLERY_CTA_NAV_LABEL,
                      href: "/gallery",
                    });
                  }}
                >
                  <IconGallery />
                  {GALLERY_CTA_NAV_LABEL}
                </Link>
                <Link
                  role="menuitem"
                  href="/trial"
                  className={menuRowNeutral}
                  onClick={() => {
                    setOpen(false);
                    track("cta_clicked", { location: trackLocation, label: "Trial overview", href: "/trial" });
                  }}
                >
                  <IconSpark />
                  Trial overview
                </Link>
              </>
            ) : (
              <>
                <Link
                  role="menuitem"
                  href="/trial/dashboard"
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-[var(--brand-teal-dark)] transition hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    track("cta_clicked", {
                      location: trackLocation,
                      label: "Workspace",
                      href: "/trial/dashboard",
                      reentry: true,
                    });
                  }}
                >
                  <IconLayout />
                  Workspace
                </Link>
                <Link
                  role="menuitem"
                  href="/gallery"
                  className={menuRowNeutral}
                  onClick={() => {
                    setOpen(false);
                    track("cta_clicked", {
                      location: trackLocation,
                      label: GALLERY_CTA_NAV_LABEL,
                      href: "/gallery",
                    });
                  }}
                >
                  <IconGallery />
                  {GALLERY_CTA_NAV_LABEL}
                </Link>
                <Link
                  role="menuitem"
                  href="/trial"
                  className={menuRowNeutral}
                  onClick={() => {
                    setOpen(false);
                    track("cta_clicked", { location: trackLocation, label: "Trial overview", href: "/trial" });
                  }}
                >
                  <IconSpark />
                  Trial overview
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
