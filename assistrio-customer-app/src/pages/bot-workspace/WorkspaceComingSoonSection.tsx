import { SettingsPageLayout, SupportPanel, WorkspaceContentContainer } from '@/layout/workspace-layout';

type Props = {
  title: string;
  description?: string;
  /** Fills the workspace under Insights (no intro strip, no max-width). */
  insightBleed?: boolean;
};

export function WorkspaceComingSoonSection({ title, description, insightBleed }: Props) {
  const defaultDescription =
    description ??
    'This area is reserved in the workspace. Functionality will ship in a future release.';

  const placeholder = (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white/70 px-6 py-16 text-center shadow-[var(--shadow-card)]"
      style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 88%, transparent)' }}
    >
      <p className="m-0 max-w-sm text-sm text-slate-500">
        We’re building this experience. Your settings and data elsewhere in the workspace are unchanged.
      </p>
    </div>
  );

  if (insightBleed) {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col">
          <header className="shrink-0 border-b border-slate-200/70 bg-white px-4 py-4 sm:px-5">
            <h1 className="m-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          </header>
          <div className="flex min-h-0 flex-1 flex-col justify-center p-4 sm:p-6">{placeholder}</div>
        </div>
      </WorkspaceContentContainer>
    );
  }

  return (
    <SettingsPageLayout
      title={title}
      description={defaultDescription}
      support={
        <SupportPanel title="While you wait">
          <p className="m-0 text-sm leading-relaxed text-slate-600">
            Use the sidebar to switch sections. Related tools may already live under Knowledge or Deploy & Go Live.
          </p>
        </SupportPanel>
      }
    >
      {placeholder}
    </SettingsPageLayout>
  );
}
