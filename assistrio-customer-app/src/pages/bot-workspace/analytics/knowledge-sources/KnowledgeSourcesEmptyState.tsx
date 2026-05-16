import { BookOpen } from 'lucide-react';
import { AnalyticsPageEmptyState } from '../shared/AnalyticsPageEmptyState';

export function KnowledgeSourcesEmptyState() {
  return (
    <AnalyticsPageEmptyState
      Icon={BookOpen}
      title="No knowledge source usage yet"
      hint="Answers that use your knowledge base will appear here. Try a longer date range if you’ve been testing in the workspace."
    />
  );
}
