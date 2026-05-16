"use client";

import React from "react";

import type { BotChatUI } from "@/models/Bot";

interface BotChatUIEditorProps {
  botName: string;
  value: BotChatUI;
  onChange: (next: BotChatUI) => void;
}

/**
 * Visual styling settings have been moved to the Appearance tab.
 * This component remains for the Chat UI tab; use Appearance for theme, launcher, composer, and branding.
 */
export default function BotChatUIEditor({ botName, value, onChange }: BotChatUIEditorProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/30">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Visual styling (theme, launcher, animation, composer, branding) is configured in the <strong>Appearance</strong> tab.
      </p>
    </div>
  );
}
