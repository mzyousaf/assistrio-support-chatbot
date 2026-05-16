import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { DataPageLayout } from '../layout/workspace-layout';

export function UsagePage() {
  const navigate = useNavigate();

  return (
    <DataPageLayout
      title="Usage"
      description="View credits and message usage for each assistant from the bot workspace."
      containerSize="standard"
    >
      <section
        className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]"
        aria-labelledby="usage-account-heading"
      >
        <h2 id="usage-account-heading" className="mb-2 mt-0 text-base font-semibold tracking-tight text-slate-900">
          Per-assistant usage
        </h2>
        <p className="m-0 text-[0.875rem] leading-[1.5] text-slate-600">
          Open an assistant, then choose <span className="font-medium text-slate-800">Usage</span> in the sidebar to see
          credits, billable vs non-billable breakdown, and voice or dictation aggregates for that assistant.
        </p>
        <Button type="button" variant="primary" className="mt-4" onClick={() => navigate('/bots')}>
          Go to My bots
        </Button>
      </section>
    </DataPageLayout>
  );
}
