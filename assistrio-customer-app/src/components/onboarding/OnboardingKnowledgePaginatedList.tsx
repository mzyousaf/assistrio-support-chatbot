import { Fragment, useId, useMemo, type ReactNode } from 'react';

import { Button, Select } from '@/components/ui';

import { OnboardingKnowledgeBulkBar } from './OnboardingKnowledgeBulkBar';
import { useOnboardingKnowledgeListPagination } from './onboardingKnowledgeListPagination';

export type OnboardingKnowledgeListSelectionConfig = {
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onTogglePage: (pageIds: readonly string[]) => void;
  onClear: () => void;
  onBulkDelete: () => void;
  disabled?: boolean;
  deleting?: boolean;
};

type Props<T> = {
  items: readonly T[];
  maxItems: number;
  getKey: (item: T) => string;
  renderItem: (item: T, selection: { selected: boolean; onToggle: () => void }) => ReactNode;
  selection?: OnboardingKnowledgeListSelectionConfig;
};

const paginationSelectTriggerClass =
  'min-h-7 h-7 max-h-7 min-w-[2.25rem] py-0 px-2 text-xs font-medium leading-none tabular-nums [&_svg]:h-3.5 [&_svg]:w-3.5';

export function OnboardingKnowledgePaginatedList<T>({
  items,
  maxItems,
  getKey,
  renderItem,
  selection,
}: Props<T>) {
  const selectAllId = useId();
  const pageSizeSelectId = useId();
  const pageSizeLabelId = useId();
  const pagination = useOnboardingKnowledgeListPagination(items, maxItems);
  const pageIds = useMemo(
    () => pagination.pageItems.map((item) => getKey(item)),
    [pagination.pageItems, getKey],
  );
  const selectionDisabled = Boolean(selection?.disabled || selection?.deleting);

  return (
    <div className="knowledge-paginated-list">
      {selection ? (
        <OnboardingKnowledgeBulkBar
          count={selection.selectedIds.size}
          pageIds={pageIds}
          selectedIds={selection.selectedIds}
          selectAllInputId={selectAllId}
          busy={selection.deleting}
          disabled={selectionDisabled}
          onTogglePage={selection.onTogglePage}
          onClear={selection.onClear}
          onRequestDelete={selection.onBulkDelete}
        />
      ) : null}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {pagination.pageItems.map((item) => {
          const key = getKey(item);
          return (
            <Fragment key={key}>
              {renderItem(item, {
                selected: selection?.selectedIds.has(key) ?? false,
                onToggle: () => selection?.onToggle(key),
              })}
            </Fragment>
          );
        })}
      </ul>

      {items.length > 0 ? (
        <nav className="knowledge-list-pagination" aria-label="List pagination">
          <div className="knowledge-list-pagination-summary">
            <div className="knowledge-list-pagination-per-page">
              <span className="knowledge-list-pagination-muted" id={pageSizeLabelId}>
                Per page
              </span>
              {pagination.pageSizeOptions.length > 1 ? (
                <Select
                  id={pageSizeSelectId}
                  quiet
                  triggerClassName={paginationSelectTriggerClass}
                  className="knowledge-list-pagination-select"
                  value={String(pagination.pageSize)}
                  onChange={(e) => pagination.setPageSize(Number.parseInt(e.target.value, 10))}
                  aria-labelledby={pageSizeLabelId}
                >
                  {pagination.pageSizeOptions.map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="knowledge-list-pagination-page-size-value" aria-labelledby={pageSizeLabelId}>
                  {pagination.pageSize}
                </span>
              )}
            </div>
            <span className="knowledge-list-pagination-divider" aria-hidden>
              |
            </span>
            <p className="knowledge-list-pagination-meta">
              Showing{' '}
              <span className="knowledge-list-pagination-meta-strong">
                {pagination.from}–{pagination.to}
              </span>{' '}
              of{' '}
              <span className="knowledge-list-pagination-meta-strong">{pagination.total}</span>
            </p>
          </div>

          {pagination.showPageControls ? (
            <div className="knowledge-list-pagination-controls">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => pagination.setPage(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="knowledge-list-pagination-page">
                Page {pagination.page} / {pagination.pageCount}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.pageCount}
                onClick={() => pagination.setPage(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
