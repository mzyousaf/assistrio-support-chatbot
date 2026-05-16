import type { CustomerUsageDictationVoiceSummary } from '@/api/types';
import { formatAnalyticsCredits, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartCard } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartCard';
import { USAGE_DASHBOARD_COPY } from './usageDashboardCopy';
import { formatUsageAudioDurationSeconds } from './usageDurationFormat';

type Props = {
  summary: CustomerUsageDictationVoiceSummary;
};

export function UsageVoiceDictationCard({ summary }: Props) {
  return (
    <AnalyticsChartCard
      title={USAGE_DASHBOARD_COPY.voiceCardTitle}
      description={USAGE_DASHBOARD_COPY.voiceCardDescription}
      bodyClassName="min-h-0"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Voice messages" value={formatAnalyticsInteger(summary.voiceMessages)} />
        <Stat label="Dictation messages" value={formatAnalyticsInteger(summary.dictationMessages)} />
        <Stat label="Dictation sessions" value={formatAnalyticsInteger(summary.dictationSessions)} />
        <Stat label="Speech words" value={formatAnalyticsInteger(summary.totalSpeechWords)} />
        <Stat label="Speech characters" value={formatAnalyticsInteger(summary.totalSpeechCharacters)} />
        <Stat label="Audio duration" value={formatUsageAudioDurationSeconds(summary.totalAudioDurationSeconds)} />
        <Stat label="Voice credits" value={formatAnalyticsCredits(summary.voiceCreditsUsed)} />
        <Stat label="Dictation credits" value={formatAnalyticsCredits(summary.dictationCreditsUsed)} />
      </div>
    </AnalyticsChartCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="m-0 mt-1 text-base font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
