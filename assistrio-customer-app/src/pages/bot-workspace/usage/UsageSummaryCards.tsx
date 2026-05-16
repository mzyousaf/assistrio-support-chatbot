import {
  CreditCard,
  MessageSquare,
  Mic,
  BadgeCheck,
  Ban,
  KeyboardMusic,
} from 'lucide-react';
import type { CustomerUsageSummary } from '@/api/types';
import { formatAnalyticsCredits, formatAnalyticsInteger, formatAnalyticsNumber } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
import { USAGE_DASHBOARD_COPY } from './usageDashboardCopy';

type Props = {
  summary: CustomerUsageSummary;
};

export function UsageSummaryCards({ summary }: Props) {
  const avg =
    summary.averageCreditsPerMessage == null
      ? '—'
      : formatAnalyticsNumber(summary.averageCreditsPerMessage, { maximumFractionDigits: 4 });

  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Credits used',
      hint: 'Credits used in selected range',
      value: formatAnalyticsCredits(summary.totalCreditsUsed),
      Icon: CreditCard,
    },
    {
      label: 'Billable credits',
      hint: USAGE_DASHBOARD_COPY.billableHint,
      value: formatAnalyticsCredits(summary.totalBillableCredits),
      Icon: BadgeCheck,
    },
    {
      label: 'Non-billable credits',
      hint: USAGE_DASHBOARD_COPY.nonBillableHint,
      value: formatAnalyticsCredits(summary.totalNonBillableCredits),
      Icon: Ban,
    },
    {
      label: 'Messages',
      hint: 'Visitor-side messages in range',
      value: formatAnalyticsInteger(summary.totalMessages),
      Icon: MessageSquare,
    },
    {
      label: 'Voice messages',
      hint: 'Messages with voice input',
      value: formatAnalyticsInteger(summary.voiceMessages),
      Icon: Mic,
    },
    {
      label: 'Dictation messages',
      hint: 'Messages from dictation / speech-to-text',
      value: formatAnalyticsInteger(summary.dictationMessages),
      Icon: KeyboardMusic,
    },
  ];

  return (
    <div className="space-y-3">
      <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
      <p className="m-0 text-[11px] leading-snug text-slate-500">
        Average credits per message in range: <span className="font-medium text-slate-700">{avg}</span>
      </p>
    </div>
  );
}
