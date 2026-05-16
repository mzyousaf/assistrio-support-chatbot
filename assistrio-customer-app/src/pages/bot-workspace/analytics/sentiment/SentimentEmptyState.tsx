import { SmilePlus } from 'lucide-react';
import { AnalyticsPageEmptyState } from '../shared/AnalyticsPageEmptyState';

export function SentimentEmptyState() {
  return (
    <AnalyticsPageEmptyState
      Icon={SmilePlus}
      title="No sentiment data for this range."
      hint="Sentiment appears after messages are classified. Try widening the date range or resetting Widget Source to all traffic."
    />
  );
}
