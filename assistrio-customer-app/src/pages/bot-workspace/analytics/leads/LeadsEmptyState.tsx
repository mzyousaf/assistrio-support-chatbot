import { ClipboardList } from 'lucide-react';
import { AnalyticsPageEmptyState } from '../shared/AnalyticsPageEmptyState';

export function LeadsEmptyState() {
  return (
    <AnalyticsPageEmptyState
      Icon={ClipboardList}
      title="No leads in this range"
      hint="Captured leads will appear after visitors share contact details. If you expected traffic, widen the date range."
    />
  );
}
