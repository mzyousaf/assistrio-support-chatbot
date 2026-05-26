import { DataPageLayout } from '../../layout/workspace-layout';

type Props = {
  title: string;
  description: string;
};

export function SettingsPlaceholderPage({ title, description }: Props) {
  return (
    <DataPageLayout title={title} description={description} containerSize="editor">
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="m-0 text-[0.9375rem] leading-[1.5] text-slate-400">
          This workspace settings area is part of the navigation shell. Functionality will ship in a later phase.
        </p>
      </div>
    </DataPageLayout>
  );
}
