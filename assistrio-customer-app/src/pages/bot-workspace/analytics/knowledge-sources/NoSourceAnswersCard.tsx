import type { CustomerKnowledgeSourcesAnalyticsSummary } from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';

type Props = {
  summary: CustomerKnowledgeSourcesAnalyticsSummary;
};

export function NoSourceAnswersCard({ summary }: Props) {
  return (
    <div className="rounded-[0.625rem] border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-base">Answers without citations</h2>
      <p className="mt-1 mb-0 text-xs leading-snug text-slate-500 sm:text-[13px]">
        Replies that did not attach knowledge sources, including fallback-style answers when flagged.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Without sources</dt>
          <dd className="m-0 mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {formatAnalyticsInteger(summary.messagesWithoutSources)}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Fallback answers</dt>
          <dd className="m-0 mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {formatAnalyticsInteger(summary.fallbackAnswers)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
