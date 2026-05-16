import { DataPageLayout } from '../layout/workspace-layout';

export function PlansPage() {
  return (
    <DataPageLayout
      title="Plans"
      description="Tiers for message volume, seats, and features. Checkout will connect here in a future release."
      containerSize="wide"
    >
      <div className="grid grid-cols-3 gap-6 max-[960px]:grid-cols-1">
        <section className="relative rounded-xl border border-slate-100 bg-white p-[1.35rem_1.4rem]" aria-labelledby="plan-free">
          <h2 id="plan-free" className="mb-[0.35rem] mt-0 text-[1.0625rem] font-semibold tracking-tight text-slate-900">
            Starter
          </h2>
          <p className="mb-4 text-[0.875rem] leading-[1.5] text-slate-400">
            Build and test agents with core limits.
          </p>
          <ul className="m-0 pl-[1.1rem] text-[0.875rem] leading-[1.65] text-slate-600">
            <li className="mb-[0.35rem]">Agents &amp; knowledge base</li>
            <li className="mb-[0.35rem]">Widget embed</li>
            <li className="mb-[0.35rem]">Email support</li>
          </ul>
        </section>

        <section
          className="relative rounded-xl border border-[var(--teal-200)] bg-[var(--teal-50)] p-[1.35rem_1.4rem]"
          aria-labelledby="plan-pro"
        >
          <p className="mb-[0.65rem] inline-block rounded-full border border-[var(--teal-200)] bg-[var(--teal-100)] px-2 py-[0.2rem] text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[var(--teal-800)]">
            Recommended
          </p>
          <h2 id="plan-pro" className="mb-[0.35rem] mt-0 text-[1.0625rem] font-semibold tracking-tight text-slate-900">
            Growth
          </h2>
          <p className="mb-4 text-[0.875rem] leading-[1.5] text-slate-400">
            Higher limits and team-ready workspace controls.
          </p>
          <ul className="m-0 pl-[1.1rem] text-[0.875rem] leading-[1.65] text-slate-600">
            <li className="mb-[0.35rem]">Increased message credits</li>
            <li className="mb-[0.35rem]">Members &amp; roles</li>
            <li className="mb-[0.35rem]">Usage insights</li>
          </ul>
        </section>

        <section className="relative rounded-xl border border-slate-100 bg-white p-[1.35rem_1.4rem]" aria-labelledby="plan-scale">
          <h2 id="plan-scale" className="mb-[0.35rem] mt-0 text-[1.0625rem] font-semibold tracking-tight text-slate-900">
            Scale
          </h2>
          <p className="mb-4 text-[0.875rem] leading-[1.5] text-slate-400">
            For high-traffic sites and custom agreements.
          </p>
          <ul className="m-0 pl-[1.1rem] text-[0.875rem] leading-[1.65] text-slate-600">
            <li className="mb-[0.35rem]">Priority support</li>
            <li className="mb-[0.35rem]">Custom contracts</li>
            <li className="mb-[0.35rem]">Dedicated success</li>
          </ul>
        </section>
      </div>

      <p className="mt-7 max-w-[36rem] text-[0.8125rem] leading-[1.5] text-slate-400">
        Billing integration is not enabled yet — this preview shows where plan selection will live.
      </p>
    </DataPageLayout>
  );
}
