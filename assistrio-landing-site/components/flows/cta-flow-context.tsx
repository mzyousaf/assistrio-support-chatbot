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
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type CtaFlowContextValue = {
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
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [showcaseSlug, setShowcaseSlug] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openShowcase = useCallback((initialSlug?: string | null) => {
    returnFocusRef.current = captureActiveElement();
    setShowcaseSlug(initialSlug ?? null);
    setShowcaseOpen(true);
  }, []);

  const close = useCallback(() => {
    const toRestore = returnFocusRef.current;
    returnFocusRef.current = null;
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
    () => ({ openShowcase, close }),
    [openShowcase, close],
  );

  useBodyScrollLock(showcaseOpen);

  return (
    <CtaFlowContext.Provider value={value}>
      <div
        className="flex min-h-screen min-h-[100dvh] w-full min-w-0 flex-1 flex-col"
        inert={showcaseOpen ? true : undefined}
        aria-hidden={showcaseOpen ? true : undefined}
      >
        {children}
      </div>
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
