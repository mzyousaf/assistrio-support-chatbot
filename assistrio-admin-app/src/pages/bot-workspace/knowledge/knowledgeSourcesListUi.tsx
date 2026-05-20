import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AdminKnowledgeStatusItem } from '@/api/types';
import { resolveKnowledgeTrainingGateMessage } from '@/lib/knowledgeTrainingMutationGate';
import { AlertTriangle, ArrowLeft, Check, FileCheck, Loader2, Search } from 'lucide-react';
import { Button, Checkbox, FilterCapsule, Input, Modal, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';

/** Initial page size for knowledge source list pages (Q&A, snippets, datasheets, suggestions). */
export const KNOWLEDGE_SOURCES_PAGE_SIZE = 5;

export const KNOWLEDGE_SOURCES_PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

export function clampKnowledgeSourcesPageSize(n: number): number {
  const v = Number.isFinite(n) ? Math.floor(Number(n)) : KNOWLEDGE_SOURCES_PAGE_SIZE;
  return (KNOWLEDGE_SOURCES_PAGE_SIZE_OPTIONS as readonly number[]).includes(v)
    ? v
    : KNOWLEDGE_SOURCES_PAGE_SIZE;
}

export type KnowledgeListSort = 'newest' | 'order' | 'title-asc' | 'title-desc';

const SORT_OPTIONS: { id: KnowledgeListSort; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'order', label: 'List order' },
  { id: 'title-asc', label: 'Title (A–Z)' },
  { id: 'title-desc', label: 'Title (Z–A)' },
];

/** Default: newest additions first (by persisted slot index or document `createdAt`). */
export const KNOWLEDGE_LIST_SORT_DEFAULT: KnowledgeListSort = 'newest';

export function sortSourceIndices(
  indices: number[],
  sort: KnowledgeListSort,
  getTitleKey: (i: number) => string,
  getNewestFirstKey?: (i: number) => number,
): number[] {
  if (sort === 'newest') {
    const keyFn = getNewestFirstKey ?? ((i: number) => i);
    const out = [...indices];
    out.sort((a, b) => {
      const ka = keyFn(a);
      const kb = keyFn(b);
      if (kb !== ka) return kb - ka;
      return a - b;
    });
    return out;
  }
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
  const option = SORT_OPTIONS.find((o) => o.id === value) ?? SORT_OPTIONS[0]!;
  const applied = value !== KNOWLEDGE_LIST_SORT_DEFAULT;
  return (
    <FilterCapsule
      title="Sort"
      valueLabel={option.label}
      applied={applied}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      onClose={() => setOpen(false)}
      onClear={() => onChange(KNOWLEDGE_LIST_SORT_DEFAULT)}
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
  pageSize: number;
  /** Called when the user picks a new page size; callers should reset `page` to 1 if needed. */
  onPageSizeChange: (size: number) => void;
  /** Distinct `id` when multiple paginations mount (e.g. `useId()`). */
  perPageSelectId: string;
  onPageChange: (p: number) => void;
  /** Extra classes on the outer bar (e.g. horizontal padding inside a documents card). */
  barClassName?: string;
};

const knowledgePaginationSelectTriggerClass =
  'min-h-8 h-8 max-h-8 py-0 px-2 text-xs leading-none [&_svg]:h-3.5 [&_svg]:w-3.5';

export function KnowledgeSourcesPagination({
  page,
  pageCount,
  totalFiltered,
  pageSize,
  onPageSizeChange,
  perPageSelectId,
  onPageChange,
  barClassName,
}: PaginationProps) {
  const safeTotal = Math.max(0, totalFiltered);
  const pageCountSafe = Math.max(1, pageCount);
  const size = Math.max(1, pageSize);
  const from = safeTotal === 0 ? 0 : (page - 1) * size + 1;
  const to = safeTotal === 0 ? 0 : Math.min(page * size, safeTotal);
  return (
    <div
      className={cn(styles.knowledgeSourcesPaginationBar, barClassName)}
      role="navigation"
      aria-label="List pagination"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        <div className="flex h-8 max-h-8 items-center gap-2">
          <span className={cn(styles.knowledgeSourcesPaginationMuted, 'whitespace-nowrap')}>Per page</span>
          <Select
            id={perPageSelectId}
            quiet
            triggerClassName={knowledgePaginationSelectTriggerClass}
            className="h-8 max-h-8 w-[4.5rem] shrink-0"
            value={String(size)}
            onChange={(e) => onPageSizeChange(clampKnowledgeSourcesPageSize(Number.parseInt(e.target.value, 10)))}
            aria-label="Items per page"
          >
            {KNOWLEDGE_SOURCES_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <p className={cn(styles.knowledgeSourcesPaginationMuted, 'm-0 flex h-8 max-h-8 items-center tabular-nums')}>
          {safeTotal === 0 ? (
            'No items to show'
          ) : (
            <>
              Showing {from}–{to} of {safeTotal}
            </>
          )}
        </p>
      </div>
      <div className="flex h-8 max-h-8 items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="md"
          className={styles.knowledgeListPaginationButton}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span
          className={cn(
            styles.knowledgeSourcesPaginationMuted,
            'flex h-8 max-h-8 items-center tabular-nums',
          )}
        >
          Page {page} / {pageCountSafe}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className={styles.knowledgeListPaginationButton}
          disabled={page >= pageCountSafe}
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
  /** e.g. count badge after title */
  titleAddon?: ReactNode;
};

export function KnowledgeSourcesToolbar({ title, search, onSearch, inputId, titleAddon }: ToolbarProps) {
  return (
    <div
      className={cn(
        'mb-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <h2
          className={cn(
            styles.workspaceEditorSectionTitle,
            'm-0 flex min-w-0 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-left',
          )}
        >
          <span>{title}</span>
          {titleAddon}
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
      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-slate-50/90 px-2 py-1"
      role="status"
      aria-label={`${count} ${noun} selected`}
    >
      <p className="m-0 min-w-0 text-xs text-slate-600 sm:text-sm">
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

export type KnowledgeTrainingGateModalProps = {
  open: boolean;
  onClose: () => void;
  /** Block reason from {@link getKnowledgeTrainingMutationBlockReason}. */
  message: string;
};

/** Shared modal when edit/delete is blocked because training (or related pipeline) is active or due imminently. */
export function KnowledgeTrainingGateModal({ open, onClose, message }: KnowledgeTrainingGateModalProps) {
  const trimmed = message.trim();
  const bodyMessageId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      allowDismiss
      tone="warning"
      title={
        <span className="inline-flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} aria-hidden />
          <span className="min-w-0 leading-snug">Please wait</span>
        </span>
      }
      ariaDescribedBy={trimmed ? bodyMessageId : undefined}
      children={
        trimmed ? (
          <p id={bodyMessageId} className="m-0 text-sm font-medium leading-snug text-amber-950/90">
            {trimmed}
          </p>
        ) : null
      }
      footer={
        <Button
          type="button"
          variant="primary"
          size="sm"
          className={styles.knowledgeModalActionPrimary}
          onClick={onClose}
        >
          Got it!
        </Button>
      }
    />
  );
}

export type KnowledgeTrainingGateAcknowledgeOptions = {
  /**
   * Invoked when the user dismisses this dialog (Got it!, Escape, or header close).
   * Use to close a confirmation dialog open underneath. Omit when a nested editor modal should stay open
   * (e.g. datasheet add/edit row).
   */
  onAcknowledge?: () => void;
};

/** Opens {@link KnowledgeTrainingGateModal} when {@link resolveKnowledgeTrainingGateMessage} returns a reason. */
export function useKnowledgeTrainingGateModal(): {
  trainingGateModal: ReactNode;
  blockIfTrainingForItem: (
    poll: Partial<AdminKnowledgeStatusItem> | null | undefined,
    row: Parameters<typeof resolveKnowledgeTrainingGateMessage>[1],
    options?: KnowledgeTrainingGateAcknowledgeOptions,
  ) => boolean;
} {
  const [trainingGateSession, setTrainingGateSession] = useState<{
    message: string;
    onAcknowledge?: () => void;
  } | null>(null);

  const dismissTrainingGate = useCallback(() => {
    setTrainingGateSession((prev) => {
      const fn = prev?.onAcknowledge;
      if (fn) queueMicrotask(fn);
      return null;
    });
  }, []);

  const blockIfTrainingForItem = useCallback(
    (
      poll: Partial<AdminKnowledgeStatusItem> | null | undefined,
      row: Parameters<typeof resolveKnowledgeTrainingGateMessage>[1],
      options?: KnowledgeTrainingGateAcknowledgeOptions,
    ) => {
      const msg = resolveKnowledgeTrainingGateMessage(poll, row);
      if (msg) {
        setTrainingGateSession({ message: msg, onAcknowledge: options?.onAcknowledge });
        return true;
      }
      return false;
    },
    [],
  );
  const trainingGateModal = (
    <KnowledgeTrainingGateModal
      open={trainingGateSession != null}
      message={trainingGateSession?.message ?? ''}
      onClose={dismissTrainingGate}
    />
  );
  return { trainingGateModal, blockIfTrainingForItem };
}

export type KnowledgeSaveConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /**
   * Primary summary under the title (emphasized in the header — same typography as deleting documents on
   * the library page).
   */
  description?: ReactNode;
  /**
   * Muted helper inside the scrollable modal body (`KnowledgeSection` delete dialogs place extra context here).
   */
  bodyNote?: ReactNode;
  /**
   * Shown in the modal body when a save conflicts with training in progress (no toast —
   * e.g. API `knowledge_training_busy`).
   */
  saveConflictNotice?: ReactNode;
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
  bodyNote,
  saveConflictNotice,
  confirmLabel = 'Save',
  busyLabel = 'Saving…',
  busy = false,
}: KnowledgeSaveConfirmModalProps) {
  const hasBody = bodyNote != null || saveConflictNotice != null;

  const headerDescription =
    description != null ? (
      <div className="font-medium leading-snug">{description}</div>
    ) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      allowDismiss={!busy}
      title={
        <span className="inline-flex items-start gap-2.5">
          <FileCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" strokeWidth={2} aria-hidden />
          <span className="min-w-0 leading-snug">{title}</span>
        </span>
      }
      description={headerDescription}
      className={cn(hasBody ? undefined : '[&_[data-modal-body]]:hidden')}
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
            {busy ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                {busyLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </>
      }
    >
      {hasBody ? (
        <div className="flex flex-col gap-5">
          {bodyNote != null ? (
            typeof bodyNote === 'string' ? (
              <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>{bodyNote}</p>
            ) : (
              bodyNote
            )
          ) : null}
          {saveConflictNotice != null ? (
            <div
              role="status"
              className="rounded-lg border border-amber-200/90 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950"
            >
              {saveConflictNotice}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
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
  /**
   * Indices where this returns true cannot be bulk-selected; header "all selected" only counts other indices.
   */
  selectionBlocked?: (index: number) => boolean;
};

export function KnowledgeSourcesPageSelectAll({
  id,
  pageIndices,
  selected,
  onToggleAllOnPage,
  endSlot,
  selectionBlocked,
}: PageSelectAllProps) {
  const ref = useRef<HTMLInputElement>(null);
  const eligibleIndices = useMemo(
    () => pageIndices.filter((i) => !selectionBlocked?.(i)),
    [pageIndices, selectionBlocked],
  );
  const allOnPage =
    eligibleIndices.length > 0 && eligibleIndices.every((i) => selected.has(i));
  const someOnPage = pageIndices.some((i) => selected.has(i));
  const checked = allOnPage;
  const indeterminate = someOnPage && !allOnPage;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  if (pageIndices.length === 0) return null;

  const showSelectAllControl = !selectionBlocked || eligibleIndices.length > 0;
  if (!showSelectAllControl && !endSlot) return null;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 border-b border-slate-200/60 pb-2.5 sm:gap-3',
        showSelectAllControl
          ? 'sm:flex-row sm:items-center sm:justify-between'
          : 'sm:flex-row sm:items-center sm:justify-end',
      )}
    >
      {showSelectAllControl ? (
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
      ) : null}
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
        className={cn(
          'shrink-0 pl-0 pr-2',
          /** Same line as crumbs: xs, no left inset, vertically centered in row */
          'h-auto min-h-0 gap-1 py-0 font-normal leading-snug text-slate-600 [&_svg]:shrink-0',
        )}
        onClick={onBack}
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        {backLabel}
      </Button>
      <span className="select-none text-slate-300" aria-hidden>
        |
      </span>
      <p className="m-0 flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5">
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
