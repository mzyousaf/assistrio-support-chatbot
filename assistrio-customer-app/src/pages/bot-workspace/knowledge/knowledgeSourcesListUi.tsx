import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Button, Checkbox, FilterCapsule, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';

export const KNOWLEDGE_SOURCES_PAGE_SIZE = 5;

export type KnowledgeListSort = 'order' | 'title-asc' | 'title-desc';

const SORT_OPTIONS: { id: KnowledgeListSort; label: string }[] = [
  { id: 'order', label: 'List order' },
  { id: 'title-asc', label: 'Title (A–Z)' },
  { id: 'title-desc', label: 'Title (Z–A)' },
];

export function sortSourceIndices(
  indices: number[],
  sort: KnowledgeListSort,
  getTitleKey: (i: number) => string,
): number[] {
  if (sort === 'order') return indices;
  const out = [...indices];
  out.sort((a, b) => {
    const ka = getTitleKey(a).toLowerCase();
    const kb = getTitleKey(b).toLowerCase();
    const c = ka.localeCompare(kb, undefined, { sensitivity: 'base' });
    return sort === 'title-asc' ? c : -c;
  });
  return out;
}

type SortFilterProps = {
  value: KnowledgeListSort;
  onChange: (s: KnowledgeListSort) => void;
};

/**
 * Dotted-pill `FilterCapsule` for list ordering (shared with Documents-style filters).
 */
export function KnowledgeSortFilterCapsule({ value, onChange }: SortFilterProps) {
  const [open, setOpen] = useState(false);
  const option = SORT_OPTIONS.find((o) => o.id === value)!;
  const applied = value !== 'order';
  return (
    <FilterCapsule
      title="Sort"
      valueLabel={option.label}
      applied={applied}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      onClose={() => setOpen(false)}
      onClear={() => onChange('order')}
    >
      <ul className="m-0 list-none space-y-0.5 p-0">
        {SORT_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                role="option"
                aria-selected={selected}
              >
                <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                  {selected ? (
                    <Check
                      className="h-3.5 w-3.5 text-[var(--color-teal-600)]"
                      strokeWidth={2.5}
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </FilterCapsule>
  );
}

type PaginationProps = {
  page: number;
  pageCount: number;
  totalFiltered: number;
  onPageChange: (p: number) => void;
};

export function KnowledgeSourcesPagination({
  page,
  pageCount,
  totalFiltered,
  onPageChange,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * KNOWLEDGE_SOURCES_PAGE_SIZE + 1;
  const to = Math.min(page * KNOWLEDGE_SOURCES_PAGE_SIZE, totalFiltered);
  return (
    <div
      className="flex shrink-0 flex-col gap-2 border-t border-slate-200/80 pt-3 sm:flex-row sm:items-center sm:justify-between sm:pt-4"
      role="navigation"
      aria-label="List pagination"
    >
      <p className="m-0 text-xs text-slate-500">
        Showing {from}–{to} of {totalFiltered}
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.knowledgeListPaginationButton}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="tabular-nums text-xs text-slate-500">
          Page {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.knowledgeListPaginationButton}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

type ToolbarProps = {
  title: string;
  search: string;
  onSearch: (q: string) => void;
  inputId: string;
};

export function KnowledgeSourcesToolbar({ title, search, onSearch, inputId }: ToolbarProps) {
  return (
    <div
      className={cn(
        'mb-3 flex w-full min-w-0 flex-col gap-2 sm:mb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <h2
          className={cn(
            styles.workspaceEditorSectionTitle,
            'm-0 shrink-0 text-left',
          )}
        >
          {title}
        </h2>
      </div>
      <div className="w-full min-w-0 sm:max-w-xs sm:shrink-0 sm:justify-items-end sm:self-end">
        <Input
          id={inputId}
          quiet
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search…"
          autoComplete="off"
          aria-label={`Search ${title}`}
          className="w-full"
          inputSize="md"
          leadingIcon={<Search size={15} strokeWidth={2} className="text-slate-400" aria-hidden />}
        />
      </div>
    </div>
  );
}

type BulkBarProps = {
  count: number;
  /** Singular for screen reader (e.g. "snippet", "Q&A", "datasheet") */
  noun: string;
  busy?: boolean;
  onRequestDelete: () => void;
  onClear: () => void;
};

export function KnowledgeSourcesBulkBar({ count, noun, busy, onRequestDelete, onClear }: BulkBarProps) {
  if (count <= 0) return null;
  return (
    <div
      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5"
      role="status"
      aria-label={`${count} ${noun} selected`}
    >
      <p className="m-0 min-w-0 text-sm text-slate-600">
        <span className="font-semibold tabular-nums text-slate-800">{count}</span>
        <span className="text-slate-500"> selected</span>
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(styles.knowledgeBulkBarButton, 'text-slate-600')}
          disabled={busy}
          onClick={onClear}
        >
          Clear
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          className={styles.knowledgeBulkBarButton}
          disabled={busy}
          aria-busy={busy}
          onClick={() => onRequestDelete()}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </div>
  );
}

export type KnowledgeDeleteModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  /** Default: "Delete" */
  confirmLabel?: string;
  busy?: boolean;
};

export function KnowledgeDeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  busy = false,
}: KnowledgeDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      allowDismiss={!busy}
      title={title}
      description={description}
      tone="danger"
      className="[&_[data-modal-body]]:hidden"
      children={null}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.knowledgeFormActionSecondary}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className={styles.knowledgeModalActionDanger}
            disabled={busy}
            aria-busy={busy}
            onClick={() => onConfirm()}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export type KnowledgeSaveConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  /** Default: "Save" */
  confirmLabel?: string;
  /** Shown on the primary button while `busy` (default: "Saving…"). */
  busyLabel?: string;
  busy?: boolean;
};

export function KnowledgeSaveConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Save',
  busyLabel = 'Saving…',
  busy = false,
}: KnowledgeSaveConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      allowDismiss={!busy}
      title={title}
      description={description}
      className="[&_[data-modal-body]]:hidden"
      children={null}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.knowledgeFormActionSecondary}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={styles.knowledgeModalActionPrimary}
            disabled={busy}
            aria-busy={busy}
            onClick={() => onConfirm()}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export type KnowledgeSuccessModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
};

export function KnowledgeSuccessModal({ open, onClose, title, description }: KnowledgeSuccessModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="[&_[data-modal-body]]:hidden"
      children={null}
      footer={
        <Button
          type="button"
          variant="primary"
          size="sm"
          className={styles.knowledgeModalActionPrimary}
          onClick={onClose}
        >
          OK
        </Button>
      }
    />
  );
}

type PageSelectAllProps = {
  id: string;
  pageIndices: number[];
  selected: ReadonlySet<number>;
  onToggleAllOnPage: () => void;
  /** Renders on the same row, opposite the checkbox (e.g. sort `FilterCapsule`). */
  endSlot?: ReactNode;
};

export function KnowledgeSourcesPageSelectAll({
  id,
  pageIndices,
  selected,
  onToggleAllOnPage,
  endSlot,
}: PageSelectAllProps) {
  const ref = useRef<HTMLInputElement>(null);
  const allOnPage =
    pageIndices.length > 0 && pageIndices.every((i) => selected.has(i));
  const someOnPage = pageIndices.some((i) => selected.has(i));
  const checked = allOnPage;
  const indeterminate = someOnPage && !allOnPage;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  if (pageIndices.length === 0) return null;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 border-b border-slate-200/60 pb-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3',
      )}
    >
      <div className="flex min-h-8 items-center gap-2">
        <Checkbox
          ref={ref}
          id={id}
          checked={checked}
          onChange={onToggleAllOnPage}
          aria-label="Select All"
        />
        <label htmlFor={id} className="m-0 cursor-pointer text-sm text-slate-700">
          Select All
        </label>
      </div>
      {endSlot ? <div className="flex min-w-0 shrink-0 items-center sm:justify-end">{endSlot}</div> : null}
    </div>
  );
}

/** One row: back control, separator, and Knowledge base / section / last crumb. */
export function KnowledgeBackBreadcrumbRow({
  backLabel,
  onBack,
  sectionLabel,
  lastCrumb,
  tailLabel,
}: {
  backLabel: string;
  onBack: () => void;
  sectionLabel: string;
  lastCrumb: string;
  /** When set, renders after the item title, e.g. `Edit` → `… / {Title} / Edit`. */
  tailLabel?: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"
      aria-label="Section navigation"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(styles.knowledgeListPaginationButton, 'shrink-0 text-slate-600')}
        onClick={onBack}
      >
        <ArrowLeft size={16} strokeWidth={2} className="shrink-0" aria-hidden />
        {backLabel}
      </Button>
      <span className="select-none text-slate-300" aria-hidden>
        |
      </span>
      <p className="m-0 flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 sm:pl-0">
        <span className="shrink-0 text-slate-400">Knowledge base</span>
        <span className="shrink-0 text-slate-300" aria-hidden>
          /
        </span>
        <span className="shrink-0 font-medium text-slate-600">{sectionLabel}</span>
        <span className="shrink-0 text-slate-300" aria-hidden>
          /
        </span>
        <span
          className="min-w-0 max-w-[min(100%,12rem)] truncate text-slate-700 sm:max-w-[min(100%,20rem)]"
          title={lastCrumb}
        >
          {lastCrumb}
        </span>
        {tailLabel ? (
          <>
            <span className="shrink-0 text-slate-300" aria-hidden>
              /
            </span>
            <span className="shrink-0 font-medium text-slate-600">{tailLabel}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

export function useSyncSelectionToListLength(
  setSelected: React.Dispatch<React.SetStateAction<Set<number>>>,
  listLength: number,
) {
  useEffect(() => {
    setSelected((prev) => {
      const n = new Set<number>();
      for (const k of prev) {
        if (k >= 0 && k < listLength) n.add(k);
      }
      return n;
    });
  }, [listLength, setSelected]);
}
