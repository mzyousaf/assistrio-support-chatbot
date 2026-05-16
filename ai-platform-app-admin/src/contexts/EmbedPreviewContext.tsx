"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { EmbedChatConfig } from "@assistrio/chat-widget";

export type EmbedPreviewOverrides = NonNullable<EmbedChatConfig["previewOverrides"]> & {
  personality?: unknown;
  config?: unknown;
  leadCapture?: unknown;
};

type EmbedPreviewContextValue = {
  previewOverrides: EmbedPreviewOverrides | null;
  setPreviewOverrides: (next: EmbedPreviewOverrides | null) => void;
};

const EmbedPreviewContext = createContext<EmbedPreviewContextValue | null>(null);

export function EmbedPreviewProvider({ children }: { children: ReactNode }) {
  const [previewOverrides, setPreviewOverridesState] = useState<EmbedPreviewOverrides | null>(null);
  const setPreviewOverrides = useCallback((next: EmbedPreviewOverrides | null) => {
    setPreviewOverridesState(next);
  }, []);
  const value = useMemo(
    () => ({ previewOverrides, setPreviewOverrides }),
    [previewOverrides, setPreviewOverrides],
  );
  return <EmbedPreviewContext.Provider value={value}>{children}</EmbedPreviewContext.Provider>;
}

export function useEmbedPreview(): EmbedPreviewContextValue {
  const ctx = useContext(EmbedPreviewContext);
  if (!ctx) {
    throw new Error("useEmbedPreview must be used within EmbedPreviewProvider");
  }
  return ctx;
}
