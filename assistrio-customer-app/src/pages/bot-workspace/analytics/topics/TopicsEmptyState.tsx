import { Tags } from 'lucide-react';
import { AnalyticsPageEmptyState } from '../shared/AnalyticsPageEmptyState';

export function TopicsEmptyState() {
  return (
    <AnalyticsPageEmptyState
      Icon={Tags}
      title="No topic data for this range."
      hint="Topics appear after messages are classified. Try widening the date range or resetting Widget Source to all traffic."
    />
  );
}
