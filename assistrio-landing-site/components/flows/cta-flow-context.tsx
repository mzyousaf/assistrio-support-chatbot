"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShowcaseFlowSheet } from "@/components/flows/showcase-flow-sheet";
import { TrialFlowModal } from "@/components/flows/trial-flow-modal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  buildTrialCtaOpenContext,
  type TrialCtaOpenContext,
  type TrialCtaOpenPayload,
} from "@/lib/flows/trial-cta-types";
import type { TrialSessionClientPayload } from "@/lib/trial/trial-session-display";

type CtaFlowContextValue = {
  /**
   * Opens the trial lead modal. Pass the same fields you send to `cta_clicked` analytics
   * (`label`, `location`, `href`) plus optional showcase context.
   */
  openTrial: (payload?: TrialCtaOpenPayload) => void;
  /** Optional slug jumps straight to preview when the bot exists in the public list. */
  openShowcase: (initialSlug?: string | null) => void;
  close: () => void;
};

const CtaFlowContext = createContext<CtaFlowContextValue | null>(null);

function captureActiveElement(): HTMLElement | null {
  const a = document.activeElement;
  if (!(a instanceof HTMLElement)) return null;
  if (a === document.body) return null;
  return a;
}

export function CtaFlowProvider({
  children,
  trialSessionClient = null,
}: {
  children: ReactNode;
  /** When set, trial CTAs route to the dashboard instead of opening the lead modal. */
  trialSessionClient?: TrialSessionClientPayload | null;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [trialOpen, setTrialOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [showcaseSlug, setShowcaseSlug] = useState<string | null>(null);
  const [trialCtaContext, setTrialCtaContext] = useState<TrialCtaOpenContext | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openTrial = useCallback(
    (payload?: TrialCtaOpenPayload) => {
      if (trialSessionClient) {
        router.push("/trial/dashboard");
        return;
      }
      returnFocusRef.current = captureActiveElement();
      setShowcaseOpen(false);
      setShowcaseSlug(null);
      setTrialCtaContext(buildTrialCtaOpenContext(pathname, payload));
      setTrialOpen(true);
    },
    [pathname, router, trialSessionClient],
  );

  const openShowcase = useCallback((initialSlug?: string | null) => {
    returnFocusRef.current = captureActiveElement();
    setTrialOpen(false);
    setTrialCtaContext(null);
    setShowcaseSlug(initialSlug ?? null);
    setShowcaseOpen(true);
  }, []);

  const close = useCallback(() => {
    const toRestore = returnFocusRef.current;
    returnFocusRef.current = null;
    setTrialOpen(false);
    setShowcaseOpen(false);
    setShowcaseSlug(null);
    setTrialCtaContext(null);
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        if (toRestore && document.contains(toRestore) && typeof toRestore.focus === "function") {
          toRestore.focus();
        }
      });
    });
  }, []);

  const value = useMemo<CtaFlowContextValue>(
    () => ({ openTrial, openShowcase, close }),
    [openTrial, openShowcase, close],
  );

  const overlayOpen = trialOpen || showcaseOpen;
  useBodyScrollLock(overlayOpen);

  return (
    <CtaFlowContext.Provider value={value}>
      <div
        className="flex min-h-screen min-h-[100dvh] w-full min-w-0 flex-1 flex-col"
        inert={overlayOpen ? true : undefined}
        aria-hidden={overlayOpen ? true : undefined}
      >
        {children}
      </div>
      <TrialFlowModal open={trialOpen} onClose={close} ctaContext={trialCtaContext} />
      <ShowcaseFlowSheet open={showcaseOpen} onClose={close} initialSlug={showcaseSlug} />
    </CtaFlowContext.Provider>
  );
}

export function useCtaFlow() {
  const ctx = useContext(CtaFlowContext);
  if (!ctx) {
    throw new Error("useCtaFlow must be used within CtaFlowProvider");
  }
  return ctx;
}
