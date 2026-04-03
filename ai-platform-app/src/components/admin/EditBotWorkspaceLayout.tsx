"use client";

import React from "react";

/** Page shell for the edit-bot form — agent workspace main column. */
export function EditBotWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 w-full">
      <div className="min-h-0">{children}</div>
    </div>
  );
}
