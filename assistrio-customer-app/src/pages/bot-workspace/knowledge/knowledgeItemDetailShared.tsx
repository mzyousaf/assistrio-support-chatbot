import { useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import { KnowledgeBackBreadcrumbRow } from './knowledgeSourcesListUi';
import {
  formatKbItemLastTrainedDateTime,
  kbItemTrainingStatusDotClassName,
  kbItemTrainingStatusLabel,
} from './knowledgeViewTypes';
import type { KbItemTrainingStatus } from './knowledgeViewTypes';

export type KnowledgeDetailTabId = 'details' | 'analytics';

export function useKnowledgeDetailTab(): [KnowledgeDetailTabId, (next: KnowledgeDetailTabId) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: KnowledgeDetailTabId = searchParams.get('tab') === 'analytics' ? 'analytics' : 'details';
  const setTab = useCallback(
    (next: KnowledgeDetailTabId) => {
      setSearchParams(next === 'analytics' ? { tab: 'analytics' } : {}, { replace: true });
    },
    [setSearchParams],
  );
  return [tab, setTab];
}

/** Matches Insights → Conversations right pane: Playground / Chat · Details tab row (`ConversationsInsightsPage`). */
export function KnowledgeDetailTabBar({
  tab,
  onTabChange,
}: {
  tab: KnowledgeDetailTabId;
  onTabChange: (t: KnowledgeDetailTabId) => void;
}) {
  return (
    <div
      className="flex w-full min-w-0 shrink-0 items-end justify-start gap-6 border-b border-slate-200/60"
      role="tablist"
      aria-label="Detail sections"
    >
      {(
        [
          { id: 'details' as const, label: 'Details' },
          { id: 'analytics' as const, label: 'Analytics' },
        ] as const
      ).map(({ id, label }) => {
        const selected = tab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              '-mb-px inline-flex shrink-0 border-b-2 px-0.5 pb-2.5 pt-1 text-sm font-medium transition',
              selected
                ? 'border-teal-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function KnowledgeItemDetailPageShell({
  backLabel,
  onBack,
  sectionLabel,
  itemTitle,
  onEdit,
  onDelete,
  deleteBusy = false,
  editDisabled = false,
  children,
  tab,
  onTabChange,
  tabContent,
  analyticsContent,
  titleSlot,
  busy = false,
}: {
  backLabel: string;
  onBack: () => void;
  sectionLabel: string;
  itemTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteBusy?: boolean;
  editDisabled?: boolean;
  children?: ReactNode;
  tab: KnowledgeDetailTabId;
  onTabChange: (t: KnowledgeDetailTabId) => void;
  tabContent: ReactNode;
  analyticsContent: ReactNode;
  titleSlot?: ReactNode;
  busy?: boolean;
}) {
  const lastCrumb = (itemTitle || 'Untitled').trim() || 'Untitled';
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 px-0 pb-8"
      data-knowledge-item-detail
    >
      <div className="shrink-0">
        <KnowledgeBackBreadcrumbRow
          backLabel={backLabel}
          onBack={onBack}
          sectionLabel={sectionLabel}
          lastCrumb={lastCrumb}
        />
      </div>
      <header className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          {titleSlot ?? (
            <h1
              className="m-0 line-clamp-2 min-w-0 break-words text-lg font-semibold leading-tight text-slate-900 sm:text-xl"
              title={lastCrumb}
            >
              {lastCrumb}
            </h1>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={styles.knowledgeDetailHeaderButtonPrimary}
            onClick={onEdit}
            disabled={editDisabled || deleteBusy}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            Edit
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(
              styles.knowledgeDetailHeaderButtonSecondary,
              'text-red-600 hover:border-red-200/80 hover:bg-red-50/90 hover:text-red-700',
            )}
            onClick={onDelete}
            disabled={editDisabled || deleteBusy}
            aria-label="Delete"
          >
            {deleteBusy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
            Delete
          </Button>
        </div>
      </header>
      <KnowledgeDetailTabBar tab={tab} onTabChange={onTabChange} />
      {busy ? (
        <div className="flex min-h-[12rem] flex-1 items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : tab === 'details' ? (
        <div className="min-h-0 flex-1">{tabContent}</div>
      ) : (
        <div className="min-h-0 flex-1">{analyticsContent}</div>
      )}
      {children}
    </div>
  );
}

export function KnowledgeItemTrainingAnalytics({
  status,
  lastTrainedAt,
}: {
  status: KbItemTrainingStatus | null | undefined;
  lastTrainedAt?: string | null;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="m-0 text-sm font-semibold text-slate-900">Training</h2>
      <dl className="m-0 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-slate-800">
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', kbItemTrainingStatusDotClassName(status))}
              aria-hidden
            />
            {kbItemTrainingStatusLabel(status)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Last trained</dt>
          <dd className="mt-0.5 text-slate-800">{formatKbItemLastTrainedDateTime(lastTrainedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
