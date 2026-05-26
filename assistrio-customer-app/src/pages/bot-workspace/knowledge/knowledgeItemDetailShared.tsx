import { useCallback, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button, Switch } from '@/components/ui';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import { KnowledgeBackBreadcrumbRow } from './knowledgeSourcesListUi';
import {
  KbTrainingStatusTag,
  KbTrainingStatusTagWithSchedule,
  KnowledgeTrainingScheduleInline,
} from '@/components/knowledge/KbTrainingStatusTag';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES } from '@/lib/knowledgeContentUtf8Limits';
import { formatKbItemLastTrainedDateTime, kbItemTrainingStatusLabel } from './knowledgeViewTypes';
import type { KbItemTrainingStatus } from './knowledgeViewTypes';
import { normalizeKnowledgeTrainingStatus } from '@/lib/knowledgeTrainingStatus';
import type { KnowledgeItemDisplayDotCanon } from '@/lib/knowledgeItemDisplayStatus';
import { TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT } from '@/lib/trainedKnowledgeStorageCopy';

export type KnowledgeDetailTabId = 'details' | 'analytics';

/** Outer column for KB item detail + edit (breadcrumb, header, body). */
export const KNOWLEDGE_ITEM_PAGE_SHELL_CLASS =
  'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden px-0 pb-4';

/** Bordered surface: Details / Analytics tabs and KB edit form bodies. */
export const KNOWLEDGE_ITEM_SURFACE_CARD_CLASS =
  'space-y-4 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

/** Gray read-only block for KB detail tab (short fields; matches document title panel). */
export const KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS =
  'm-0 min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap [word-break:break-word] text-slate-800';

/** Scrollable panel for long KB detail body (matches document content `pre`). */
export const KNOWLEDGE_ITEM_DETAIL_BODY_PRE_CLASS =
  'm-0 min-h-[12rem] flex-1 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap [word-break:break-word] text-slate-800';

/** `Input` wrapper for inline KB titles: bottom border only, flush background, no inset focus halo. */
export const KNOWLEDGE_INLINE_TITLE_INPUT_WRAPPER_CLASS = cn(
  'rounded-none border-0 border-b border-slate-300/90 bg-transparent !shadow-none',
  'focus-within:!shadow-none',
  '[&:hover:not(:focus-within,[data-invalid=true])]:border-slate-400',
);

/** Scrollable card region matching detail tab panels (editor forms). */
export function KnowledgeItemEditScrollSurface({
  children,
  layout = 'content',
}: {
  children: ReactNode;
  /**
   * `fill`: card fills space below the page header so a primary `flex-1` textarea can track viewport height.
   * `content`: height follows content, capped by the editor column (default lists / short forms).
   */
  layout?: 'content' | 'fill';
}) {
  const fill = layout === 'fill';
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          KNOWLEDGE_ITEM_SURFACE_CARD_CLASS,
          'box-border flex w-full min-w-0 flex-col',
          fill
            ? 'min-h-0 flex-1 overflow-hidden'
            : 'h-fit min-h-0 max-h-full overflow-x-hidden overflow-y-auto overscroll-contain',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Primary KB editor body: grows with available height; no drag-resize past layout bounds. */
export const KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS =
  'min-h-[8rem] flex-1 resize-none overflow-y-auto font-sans text-sm leading-relaxed';

/**
 * List-page “Add …” cards (Snippet description, Q&A answer, Suggestion scope): fixed height, scroll inside,
 * no resize handle so layout stays stable.
 */
export const KNOWLEDGE_LIST_ADD_TEXTAREA_FIXED_CLASS =
  'h-[11rem] min-h-[11rem] max-h-[11rem] w-full resize-none overflow-y-auto';

/** Uppercase “Edit …” line above snippet/Q&A/suggestion editor fields — breathing room before the form. */
export const KNOWLEDGE_EDIT_MODE_SECTION_LABEL_CLASS =
  'pb-5 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500';

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

/** Matches Insights → Conversations right pane: Chat + CRM tabs row (`ConversationsInsightsPage`). */
export function KnowledgeDetailTabBar({
  tab,
  onTabChange,
}: {
  tab: KnowledgeDetailTabId;
  onTabChange: (t: KnowledgeDetailTabId) => void;
}) {
  return (
    <div
      className="relative flex w-full min-w-0 shrink-0 items-end justify-start gap-6 border-b border-slate-200/60"
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
              'relative inline-flex shrink-0 px-0.5 pb-2.5 pt-1 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
              "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:z-[2] after:h-0.5 after:origin-center after:bg-teal-600 after:transition-[transform,opacity] after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none",
              selected
                ? 'z-[1] text-slate-900 after:scale-x-100 after:opacity-100'
                : 'text-slate-500 hover:text-slate-800 after:scale-x-0 after:opacity-0',
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

function trimAnalyticsStr(v: string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/** Visible chip text for Use in Replies eligibility. */
export const KNOWLEDGE_USE_IN_REPLIES_TAG_LABELS = {
  active: 'Used in replies',
  excluded: 'Not used in replies',
} as const;

/** Native `title` tooltips for the Use in Replies chips. */
export const KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS = {
  active:
    'Used in assistant replies when this item is trained and eligible.',
  excluded:
    'Excluded from replies. This item stays saved in your knowledge library.',
} as const;

export function KnowledgeUseInRepliesTag({
  active,
  className,
  /** Portal tooltip on hover (knowledge list rows); otherwise native `title`. */
  showHoverDescription = false,
}: {
  active: boolean;
  className?: string;
  showHoverDescription?: boolean;
}) {
  const label = active ? KNOWLEDGE_USE_IN_REPLIES_TAG_LABELS.active : KNOWLEDGE_USE_IN_REPLIES_TAG_LABELS.excluded;
  const tip = active ? KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.active : KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.excluded;
  const inner = (
    <span
      className={cn(
        'inline-flex h-[18px] max-w-full min-w-0 cursor-default items-center rounded border px-1.5 py-px text-[11px] font-medium leading-tight',
        active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600',
        className,
      )}
      title={showHoverDescription ? undefined : tip}
      aria-label={`Use in Replies: ${label}`}
    >
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
  if (showHoverDescription) {
    return (
      <Tooltip content={tip} panelClassName="max-w-[18rem] text-pretty" side="top">
        {inner}
      </Tooltip>
    );
  }
  return inner;
}

/** Suggestions list: chip visibility in widget (same green/gray treatment as {@link KNOWLEDGE_USE_IN_REPLIES_TAG_LABELS}). */
export const KNOWLEDGE_CHIP_IN_CHAT_LIST_TAG_LABELS = {
  shown: 'Chip is visible',
  /** Omitted from the visitor chat UI; not the same as “use in replies”. */
  hidden: 'Chip is hidden',
} as const;

export const KNOWLEDGE_CHIP_IN_CHAT_LIST_TAG_TOOLTIPS = {
  shown:
    'Visitors can see this starter chip in the chat widget when suggestion chips are enabled.',
  hidden:
    'This chip is hidden from the chat widget—visitors will not see it. Training and use in replies are unchanged.',
} as const;

/** Suggestions list: green when the chip is shown in chat, gray when hidden (same treatment as Use in replies). */
export function KnowledgeSuggestionChipLabelVisibilityTag({
  chipLabelHidden,
  className,
}: {
  chipLabelHidden: boolean;
  className?: string;
}) {
  const shown = !chipLabelHidden;
  const label = shown
    ? KNOWLEDGE_CHIP_IN_CHAT_LIST_TAG_LABELS.shown
    : KNOWLEDGE_CHIP_IN_CHAT_LIST_TAG_LABELS.hidden;
  const tip = shown ? KNOWLEDGE_CHIP_IN_CHAT_LIST_TAG_TOOLTIPS.shown : KNOWLEDGE_CHIP_IN_CHAT_LIST_TAG_TOOLTIPS.hidden;
  const inner = (
    <span
      className={cn(
        'inline-flex h-[18px] max-w-full min-w-0 cursor-default items-center rounded border px-1.5 py-px text-[11px] font-medium leading-tight',
        shown
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-600',
        className,
      )}
      aria-label={`Chip in chat: ${label}`}
    >
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
  return (
    <Tooltip content={tip} panelClassName="max-w-[18rem] text-pretty" side="top">
      {inner}
    </Tooltip>
  );
}

/** Toggle runtime reply eligibility (PATCH use-in-replies). */
export function KnowledgeDetailUseInRepliesSwitchRow({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-medium text-slate-500">Use in replies</span>
      <Switch
        checked={checked}
        disabled={disabled}
        showLabels
        onLabel="Yes"
        offLabel="No"
        aria-label={
          checked
            ? 'Use in replies: Yes. Click to set to No.'
            : 'Use in replies: No. Click to set to Yes.'
        }
        title={
          checked ? KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.active : KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.excluded
        }
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

const SHOW_CHIP_IN_CHAT_TOOLTIP =
  'When Yes, the chip is visible in the chat widget (when suggestion chips are enabled). When No, the chip is hidden. Other suggestions are unchanged. Does not affect training or use in replies.';

/** Toggle widget-only visibility of this suggestion’s chip (not “Use in replies”). `checked` is hideChipTextInChat. */
export function KnowledgeDetailHideChipTextSwitchRow({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (hideChipTextInChat: boolean) => void;
}) {
  const showInChat = !checked;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-medium text-slate-500">Chip is visible</span>
      <Switch
        checked={showInChat}
        disabled={disabled}
        showLabels
        onLabel="Yes"
        offLabel="No"
        aria-label={
          showInChat
            ? 'Chip is visible: Yes. Click to hide this chip from the chat widget.'
            : 'Chip is visible: No. Click to make this chip visible in the chat widget again.'
        }
        title={SHOW_CHIP_IN_CHAT_TOOLTIP}
        onCheckedChange={(nextShowInChat) => onCheckedChange(!nextShowInChat)}
      />
    </div>
  );
}

/** Lifecycle pill for KB item Details tab; shows countdown beside the pill when training is queued with `runAfter`. */
export function KnowledgeDetailKbLifecycleTrainingPill({
  planLimit,
  kbLifecyclePresentation,
  runAfter,
}: {
  planLimit: boolean;
  kbLifecyclePresentation: { label: string; dotCanon: KnowledgeItemDisplayDotCanon } | null;
  runAfter?: string | null;
}) {
  if (planLimit) {
    return (
      <KbTrainingStatusTag
        className="font-normal"
        label={TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT}
        statusForBadge="failed"
      />
    );
  }
  if (!kbLifecyclePresentation) return null;
  return (
    <KbTrainingStatusTagWithSchedule
      className="font-normal"
      label={kbLifecyclePresentation.label}
      statusForBadge={kbLifecyclePresentation.dotCanon}
      row={{ runAfter: runAfter ?? null }}
      dotCanon={kbLifecyclePresentation.dotCanon}
      sublineLayout="inline-pipe"
    />
  );
}

/** Optional training pill + optional trailing control (e.g. Use in replies), with a divider when both. */
export function KnowledgeDetailTabTitleAccessoryStack({
  leading,
  trailing,
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  if (!leading && !trailing) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {leading}
      {leading && trailing ? (
        <span className="text-slate-300" aria-hidden>
          |
        </span>
      ) : null}
      {trailing}
    </div>
  );
}

/** One analytics metric as a compact card (label + value). */
function KnowledgeAnalyticsStatRow({
  label,
  tabular = true,
  /** Renders on the same row as the label (e.g. training countdown beside “Training status”). */
  labelAccessory,
  children,
}: {
  label: string;
  tabular?: boolean;
  labelAccessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-slate-200/90 bg-slate-50/50 px-3 py-3 sm:px-4 sm:py-3.5',
        'shadow-[0_1px_2px_rgba(15,23,42,0.03)]',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <dt className="m-0 min-w-0 text-xs font-semibold text-slate-600">{label}</dt>
        {labelAccessory != null ? (
          <div className="min-w-0 shrink-0 text-xs font-normal leading-none text-slate-600">{labelAccessory}</div>
        ) : null}
      </div>
      <dd
        className={cn(
          'm-0 mt-1.5 min-w-0 text-sm font-normal leading-snug text-slate-600',
          tabular && 'tabular-nums',
        )}
      >
        {children}
      </dd>
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
  editDisabledTitle,
  hideDelete = false,
  children,
  tab,
  onTabChange,
  tabContent,
  analyticsContent,
  titleSlot,
  detailsTabTitleAccessory,
  busy = false,
  breadcrumbInLayout = false,
  /** When true, the Details tab card stretches to fill vertical space (scroll inside `tabContent`). */
  detailsTabFillHeight = false,
  /** Overrides the default primary header button label (e.g. “View in full screen”). */
  editButtonLabel,
  /** Overrides the default pencil icon on the primary header button. */
  EditIcon,
}: {
  backLabel: string;
  onBack: () => void;
  sectionLabel: string;
  itemTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteBusy?: boolean;
  editDisabled?: boolean;
  /** Native tooltip when edit is disabled (e.g. extraction still running). */
  editDisabledTitle?: string;
  /** When true, the delete control is not shown (e.g. document still extracting). */
  hideDelete?: boolean;
  children?: ReactNode;
  tab: KnowledgeDetailTabId;
  onTabChange: (t: KnowledgeDetailTabId) => void;
  tabContent: ReactNode;
  analyticsContent: ReactNode;
  titleSlot?: ReactNode;
  /** Rendered under the title on both Details and Analytics tabs (e.g. Use in replies). */
  detailsTabTitleAccessory?: ReactNode;
  busy?: boolean;
  breadcrumbInLayout?: boolean;
  detailsTabFillHeight?: boolean;
  editButtonLabel?: string;
  EditIcon?: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const PrimaryIcon = EditIcon ?? Pencil;
  const primaryEditLabel = editButtonLabel ?? 'Edit';
  const lastCrumb = (itemTitle || 'Untitled').trim() || 'Untitled';
  const outerClass = breadcrumbInLayout
    ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden'
    : KNOWLEDGE_ITEM_PAGE_SHELL_CLASS;
  return (
    <div className={cn(outerClass)} data-knowledge-item-detail>
      {breadcrumbInLayout ? null : (
        <div className="shrink-0">
          <KnowledgeBackBreadcrumbRow
            backLabel={backLabel}
            onBack={onBack}
            sectionLabel={sectionLabel}
            lastCrumb={lastCrumb}
          />
        </div>
      )}
      <header className="flex w-full min-w-0 shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          {titleSlot ?? (
            <h1
              className="m-0 line-clamp-2 min-w-0 break-words text-lg font-medium leading-tight text-slate-900 sm:text-xl"
              title={lastCrumb}
            >
              {lastCrumb}
            </h1>
          )}
          {detailsTabTitleAccessory ? (
            <div className="mt-2 min-w-0 pt-0.5">{detailsTabTitleAccessory}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={styles.knowledgeDetailHeaderButtonPrimary}
            onClick={onEdit}
            disabled={editDisabled || deleteBusy}
            title={editDisabled && editDisabledTitle ? editDisabledTitle : undefined}
          >
            <PrimaryIcon className="h-3.5 w-3.5" strokeWidth={2} />
            {primaryEditLabel}
          </Button>
          {hideDelete ? null : (
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
              {deleteBusy ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Delete
            </Button>
          )}
        </div>
      </header>
      <KnowledgeDetailTabBar tab={tab} onTabChange={onTabChange} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start overflow-hidden">
        {busy ? (
          <div
            className={cn(
              'box-border flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden',
              KNOWLEDGE_ITEM_SURFACE_CARD_CLASS,
            )}
          >
            <Loader2 className="h-8 w-8 shrink-0 animate-spin text-slate-400" aria-hidden />
          </div>
        ) : tab === 'details' ? (
          <div
            className={cn(
              KNOWLEDGE_ITEM_SURFACE_CARD_CLASS,
              'box-border w-full min-w-0',
              detailsTabFillHeight
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                : 'h-fit min-h-0 max-h-full overflow-x-hidden overflow-y-auto overscroll-contain',
            )}
            role="tabpanel"
          >
            {tabContent}
          </div>
        ) : (
          <div
            className={cn(
              KNOWLEDGE_ITEM_SURFACE_CARD_CLASS,
              'box-border h-fit min-h-0 max-h-full w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain',
            )}
            role="tabpanel"
          >
            {analyticsContent}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function KnowledgeItemTrainingAnalytics({
  status,
  lastTrainedAt,
  updatedAt,
  utf8SizeLabel,
  actions,
  statusLabelOverride,
  forceFailedStatusDot,
  kbLifecyclePresentation,
  statusDetail,
  documentNameUtf8Source,
  trainingScheduleRunAfter,
  trainingStatusSubline,
  trainingLifecycleRaw,
  /** When true, omits the “Training status” analytics row (e.g. shown on the Details tab instead). */
  hideTrainingStatus,
  /** When true, omits “Last trained” (e.g. chip-only suggestions with no scoped KB text). */
  hideLastTrained,
}: {
  status: KbItemTrainingStatus | KnowledgeItemDisplayDotCanon | null | undefined;
  lastTrainedAt?: string | null;
  /** ISO content/knowledge row update when the API exposes it */
  updatedAt?: string | null;
  /** Stored content size, formatted (e.g. via {@link formatKnowledgeUtf8BytesDisplay}). */
  utf8SizeLabel?: string | null;
  actions?: ReactNode;
  /** Replaces the default label from `status` (e.g. “Storage limit reached”). */
  statusLabelOverride?: string | null;
  /** When true, status dot uses the failed tone regardless of `status`. */
  forceFailedStatusDot?: boolean;
  /** When set (non-storage failures), aligns detail analytics with list KB chips (lifecycle + import priority). */
  kbLifecyclePresentation?: { label: string; dotCanon: KnowledgeItemDisplayDotCanon } | null;
  /** When set (e.g. documents), replaces the default status chip row. */
  statusDetail?: ReactNode;
  /** When set (documents), Analytics shows UTF-8 usage for the displayed title vs title limit. */
  documentNameUtf8Source?: string | null;
  /** ISO `runAfter` for queued delayed training (countdown only when lifecycle is `queued`). */
  trainingScheduleRunAfter?: string | null;
  /** Static subline on the status pill (non-countdown hints only). */
  trainingStatusSubline?: string | null;
  /** Raw poll/row KB `status` for schedule eligibility (not reply-excluded display canon). */
  trainingLifecycleRaw?: string | null;
  hideTrainingStatus?: boolean;
  /** When true, omits “Last trained” (e.g. chip-only suggestions with no scoped KB text). */
  hideLastTrained?: boolean;
}) {
  const lifecycleLabel = trimAnalyticsStr(kbLifecyclePresentation?.label);
  const overrideLabel = trimAnalyticsStr(statusLabelOverride);
  const statusChipLabel =
    forceFailedStatusDot
      ? overrideLabel ?? kbItemTrainingStatusLabel(status as KbItemTrainingStatus)
      : lifecycleLabel ?? overrideLabel ?? kbItemTrainingStatusLabel(status as KbItemTrainingStatus);

  const statusForBadge = forceFailedStatusDot
    ? 'failed'
    : kbLifecyclePresentation != null
      ? kbLifecyclePresentation.dotCanon
      : normalizeKnowledgeTrainingStatus(status);

  const scheduleIso = trimAnalyticsStr(trainingScheduleRunAfter);
  const schedRaw =
    typeof trainingLifecycleRaw === 'string' && trainingLifecycleRaw.trim()
      ? trainingLifecycleRaw.trim()
      : '';
  const scheduleCanon = schedRaw ? normalizeKnowledgeTrainingStatus(schedRaw) : null;
  const showScheduleRow =
    !forceFailedStatusDot &&
    Boolean(scheduleIso) &&
    scheduleCanon != null &&
    scheduleCanon === 'queued';

  const defaultStatusChip =
    statusDetail != null ? null : (
      <KbTrainingStatusTag
        className="font-normal"
        label={statusChipLabel}
        statusForBadge={statusForBadge}
        subline={trimAnalyticsStr(trainingStatusSubline) ?? null}
      />
    );

  const sizeLine = utf8SizeLabel != null && String(utf8SizeLabel).trim() ? String(utf8SizeLabel).trim() : '—';

  return (
    <div className="min-w-0">
      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!hideTrainingStatus ? (
          <KnowledgeAnalyticsStatRow
            label="Training status"
            tabular={false}
            labelAccessory={
              showScheduleRow && scheduleCanon != null ? (
                <KnowledgeTrainingScheduleInline
                  runAfter={scheduleIso}
                  trainingStatusForSchedule={scheduleCanon}
                  timerClassName="!text-xs !font-semibold sm:!text-sm"
                />
              ) : null
            }
          >
            <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {statusDetail ?? defaultStatusChip}
            </span>
          </KnowledgeAnalyticsStatRow>
        ) : null}
        {!hideLastTrained ? (
          <KnowledgeAnalyticsStatRow label="Last trained" tabular={false}>
            {formatKbItemLastTrainedDateTime(lastTrainedAt, { emptyLabel: '—' })}
          </KnowledgeAnalyticsStatRow>
        ) : null}
        {documentNameUtf8Source != null ? (
          <KnowledgeAnalyticsStatRow label="Title">
            <KnowledgeUtf8Meter
              value={documentNameUtf8Source}
              maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES}
              className="text-sm text-slate-600"
            />
          </KnowledgeAnalyticsStatRow>
        ) : null}
        <KnowledgeAnalyticsStatRow label="Stored content">{sizeLine}</KnowledgeAnalyticsStatRow>
        <KnowledgeAnalyticsStatRow label="Updated" tabular={false}>
          {formatKbItemLastTrainedDateTime(updatedAt, { emptyLabel: '—' })}
        </KnowledgeAnalyticsStatRow>
      </dl>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
