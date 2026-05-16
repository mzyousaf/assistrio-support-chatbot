import { BarChart3 } from 'lucide-react';
import { AnalyticsPageEmptyState } from '../shared/AnalyticsPageEmptyState';

import { AnalyticsPageSkeleton as SharedAnalyticsPageSkeleton } from '../shared/AnalyticsPageSkeleton';

export { AnalyticsErrorState } from '../shared/AnalyticsErrorState';

export function AnalyticsPageSkeleton() {
  return <SharedAnalyticsPageSkeleton layout="chats" />;
}

export function AnalyticsEmptyState() {
  return (
    <AnalyticsPageEmptyState
      Icon={BarChart3}
      title="No chats in this range"
      hint="Widen the date range if you’ve been testing in the workspace."
    />
  );
}
