"use client";

import { createContext, useContext } from "react";

import type { BotFormEditorModel } from "./BotFormEditorModel";

const BotFormEditorContext = createContext<BotFormEditorModel | null>(null);

export function BotFormEditorProvider({
  value,
  children,
}: {
  value: BotFormEditorModel;
  children: React.ReactNode;
}) {
  return <BotFormEditorContext.Provider value={value}>{children}</BotFormEditorContext.Provider>;
}

export function useBotFormEditor(): BotFormEditorModel {
  const ctx = useContext(BotFormEditorContext);
  if (!ctx) {
    throw new Error("useBotFormEditor must be used within BotFormEditorProvider");
  }
  return ctx;
}
