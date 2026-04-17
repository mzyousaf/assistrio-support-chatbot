import { SettingsPageLayout, SupportPanel } from '@/layout/workspace-layout';

type Props = {
  title: string;
  description?: string;
};

export function WorkspaceComingSoonSection({ title, description }: Props) {
  return (
    <SettingsPageLayout
      title={title}
      description={
        description ??
        'This area is reserved in the workspace. Functionality will ship in a future release.'
      }
      support={
        <SupportPanel title="While you wait">
          <p className="m-0 text-sm leading-relaxed text-slate-600">
            Use the sidebar to switch sections. Related tools may already live under Knowledge or Publish.
          </p>
        </SupportPanel>
      }
    >
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white/70 px-6 py-16 text-center shadow-[var(--shadow-card)]"
        style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 88%, transparent)' }}
      >
        <p className="m-0 max-w-sm text-sm text-slate-500">
          We’re building this experience. Your settings and data elsewhere in the workspace are unchanged.
        </p>
      </div>
    </SettingsPageLayout>
  );
}
