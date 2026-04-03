"use client";

import AdminShell from "@/components/admin/AdminShell";

type WorkspaceSettingsPlaceholderProps = {
  title: string;
  /** Shown under the title in the page header. */
  subtitle?: string;
  description?: string;
};

export function WorkspaceSettingsPlaceholder({
  title,
  subtitle,
  description = "Configure this area from the workspace settings roadmap. Existing limits and billing flows can be wired here.",
}: WorkspaceSettingsPlaceholderProps) {
  return (
    <AdminShell title={title} subtitle={subtitle}>
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
      </div>
    </AdminShell>
  );
}
