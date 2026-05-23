import { Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button, Checkbox } from '@/components/ui';

type Props = {
  count: number;
  pageIds: readonly string[];
  selectedIds: ReadonlySet<string>;
  selectAllInputId: string;
  busy?: boolean;
  disabled?: boolean;
  onTogglePage: (pageIds: readonly string[]) => void;
  onRequestDelete: () => void;
  onClear: () => void;
};

export function OnboardingKnowledgeBulkBar({
  count,
  pageIds,
  selectedIds,
  selectAllInputId,
  busy,
  disabled,
  onTogglePage,
  onRequestDelete,
  onClear,
}: Props) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const allOnPage = pageIds.length > 0 && pageIds.every((itemId) => selectedIds.has(itemId));
  const someOnPage = pageIds.some((itemId) => selectedIds.has(itemId));
  const indeterminate = someOnPage && !allOnPage;

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  if (count <= 0) return null;

  return (
    <div
      className="knowledge-list-bulk-bar"
      role="status"
      aria-label={`${count} selected`}
    >
      <div className="knowledge-list-bulk-bar-main">
        {pageIds.length > 0 ? (
          <div className="knowledge-list-select-all">
            <Checkbox
              ref={checkboxRef}
              id={selectAllInputId}
              checked={allOnPage}
              disabled={disabled || busy}
              onChange={() => onTogglePage(pageIds)}
              aria-label="Select all on this page"
            />
            <label htmlFor={selectAllInputId} className="knowledge-list-select-all-label">
              Select all on this page
            </label>
          </div>
        ) : null}
        {pageIds.length > 0 ? <span className="knowledge-list-bulk-bar-divider" aria-hidden>|</span> : null}
        <p className="knowledge-list-bulk-bar-copy">
          <span className="knowledge-list-bulk-bar-count">{count}</span>
          <span className="knowledge-list-bulk-bar-label"> selected</span>
        </p>
      </div>
      <div className="knowledge-list-bulk-bar-actions">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClear}>
          <X className="size-3.5" aria-hidden />
          <span className="ml-1">Clear</span>
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={busy} aria-busy={busy} onClick={onRequestDelete}>
          <Trash2 className="size-3.5" aria-hidden />
          <span className="ml-1">{busy ? 'Deleting…' : 'Delete selected'}</span>
        </Button>
      </div>
    </div>
  );
}
