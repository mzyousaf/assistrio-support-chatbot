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
import { ShowcaseFlowSheet } from "@/components/flows/showcase-flow-sheet";
import { TrialFlowModal } from "@/components/flows/trial-flow-modal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type CtaFlowContextValue = {
  openTrial: () => void;
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

export function CtaFlowProvider({ children }: { children: ReactNode }) {
  const [trialOpen, setTrialOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [showcaseSlug, setShowcaseSlug] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openTrial = useCallback(() => {
    returnFocusRef.current = captureActiveElement();
    setShowcaseOpen(false);
    setShowcaseSlug(null);
    setTrialOpen(true);
  }, []);

  const openShowcase = useCallback((initialSlug?: string | null) => {
    returnFocusRef.current = captureActiveElement();
    setTrialOpen(false);
    setShowcaseSlug(initialSlug ?? null);
    setShowcaseOpen(true);
  }, []);

  const close = useCallback(() => {
    const toRestore = returnFocusRef.current;
    returnFocusRef.current = null;
    setTrialOpen(false);
    setShowcaseOpen(false);
    setShowcaseSlug(null);
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
      <TrialFlowModal open={trialOpen} onClose={close} />
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
