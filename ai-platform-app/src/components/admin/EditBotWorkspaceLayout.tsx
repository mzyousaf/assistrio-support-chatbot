"use client";

import React from "react";

/** Page shell for the edit-bot form. */
export function EditBotWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1400px] w-full mx-auto px-6 xl:px-8 py-6">
      <div className="min-h-0">{children}</div>
    </div>
  );
}
