import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Pencil,
  PencilLine,
  Plus,
  Rocket,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useBotLifecycleControls } from '@/context/BotLifecycleContext';
import { Button, Card, CardBody, FieldRow, Input, Modal, Switch } from '@/components/ui';
import { normalizeCustomerEmbedOrigin } from '@/lib/embedOrigin';
import { cn } from '@/lib/utils';
import { FeStackTags } from './FeStackTags';
import { getInstallSetupGuide } from './installSetupGuide';
import { MAX_ALLOWED_ORIGINS } from './publishConstants';
import {
  wouldLoseAllActiveOriginsAfterRemove,
  wouldLoseAllActiveOriginsAfterUpdate,
} from './publishOriginHelpers';
import { usePublishWorkspace, type EmbedInstallMode } from './PublishWorkspaceContext';
import { VISIBILITY_CHOICE_OPTIONS, VISIBILITY_CHOICE_SUBTITLE } from './visibilityChoiceCopy';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ws } from './workspace';

const PAGE_TITLE = 'Deploy & Go Live';

const standardCardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';

const readOnlyMono = cn(
  ws.workspaceEditorControlInput,
  'cursor-default border-slate-200/90 bg-slate-50/90 font-mono text-[0.8125rem] text-slate-800 selection:bg-slate-200/80',
);

const snippetPreClass =
  'm-0 max-h-[14rem] overflow-auto rounded-lg border border-slate-800/80 bg-slate-900 px-3 py-2.5 text-left font-mono text-[0.6875rem] leading-relaxed text-slate-100 shadow-inner';

const pageSectionsClass = cn(ws.workspaceEditorCardGap, 'gap-6');

type ChoiceCardProps<T extends string> = {
  name: string;
  subtitle?: string;
  value: T;
  options: { value: T; label: string; hint: string; disabled?: boolean }[];
  onChange: (next: T) => void;
  savingTarget?: T | null;
};

function ChoiceCardOptionSavingOverlay() {
  return (
    <div
      className="absolute inset-0 z-[2] rounded-lg"
      aria-busy="true"
      aria-live="polite"
      aria-label="Saving visibility"
    >
      <div className="absolute inset-0 rounded-lg bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]" aria-hidden />
      <div className="relative z-[1] flex h-full min-h-[4.5rem] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-teal-600)]" strokeWidth={2} aria-hidden />
      </div>
    </div>
  );
}

function ChoiceCardGroup<T extends string>({
  name,
  subtitle,
  value,
  options,
  onChange,
  savingTarget = null,
}: ChoiceCardProps<T>) {
  const choiceSaving = savingTarget !== null;
  return (
    <div className="w-full min-w-0 space-y-2" role="radiogroup" aria-label={name}>
      <div>
        <p className={cn(ws.workspaceEditorControlLabel, 'm-0')}>{name}</p>
        {subtitle ? (
          <p className={cn(ws.workspaceEditorHelperText, 'm-0 mt-1 max-w-prose leading-snug')}>{subtitle}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const interactionDisabled = Boolean(opt.disabled) || choiceSaving;
          const selected = value === opt.value;
          const savingThisOption = savingTarget === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={interactionDisabled}
              aria-busy={savingThisOption || undefined}
              disabled={interactionDisabled}
              onClick={() => {
                if (!interactionDisabled) onChange(opt.value);
              }}
              className={cn(
                'relative flex w-full flex-col items-start rounded-lg border px-3.5 py-3 text-left transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal-600)]',
                interactionDisabled &&
                  !selected &&
                  'cursor-not-allowed border-slate-200/80 bg-slate-50/90 text-slate-500 opacity-[0.85] hover:border-slate-200/80 hover:bg-slate-50/90',
                interactionDisabled &&
                  selected &&
                  'cursor-not-allowed border-[var(--color-teal-600)] bg-[var(--teal-50)] ring-1 ring-[var(--color-teal-600)]/25',
                !interactionDisabled &&
                  (selected
                    ? 'border-[var(--color-teal-600)] bg-[var(--teal-50)] ring-1 ring-[var(--color-teal-600)]/25'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80'),
              )}
            >
              {savingThisOption ? <ChoiceCardOptionSavingOverlay /> : null}
              <span className={cn('text-sm font-semibold', !selected && interactionDisabled ? 'text-slate-500' : 'text-slate-900')}>
                {opt.label}
              </span>
              <span className="mt-1 text-xs leading-snug text-slate-500">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const keyFieldTrailingBtn =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--ui-radius)] text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal-600)] focus-visible:ring-offset-1';

/** Same overlay pattern as Quick links / Lead capture when the section is gated. */
function WidgetSetupChoicesSavingOverlay() {
  return (
    <div
      className="absolute inset-0 z-[2] min-h-[8rem] rounded-lg"
      aria-busy="true"
      aria-live="polite"
      aria-label="Saving deploy settings"
    >
      <div className="absolute inset-0 rounded-lg bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]" aria-hidden />
      <div className="relative z-[1] flex h-full min-h-[8rem] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-teal-600)]" strokeWidth={2} aria-hidden />
      </div>
    </div>
  );
}

function ModalButtonLabel({
  loading,
  children,
  savingLabel,
}: {
  loading: boolean;
  children: ReactNode;
  savingLabel: string;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
      {loading ? savingLabel : children}
    </span>
  );
}

function InstallApiKeysLockedOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[1] min-h-[10rem] rounded-[inherit] p-4 sm:p-5">
      <div
        className="absolute inset-0 rounded-[inherit] bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]"
        aria-hidden
      />
      <div className="relative z-[1] flex h-full min-h-0 flex-col">
        <div className="h-[25%] min-h-10 shrink-0" aria-hidden />
        <div className="flex w-full shrink-0 justify-center">
          <div
            className="max-w-[18rem] rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 text-center shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05]"
            role="status"
          >
            <div
              className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              aria-hidden
            >
              <Lock className="h-4 w-4" strokeWidth={2} />
            </div>
            <p className="m-0 text-sm font-semibold leading-snug text-slate-900">Add an active website first</p>
            <div className={cn(ws.workspaceEditorControlHint, 'mt-1.5 text-pretty')}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

type OriginModal = null | { mode: 'add' } | { mode: 'edit'; index: number };

type LiveOriginDraftWarning =
  | { kind: 'delete'; index: number; row: { origin: string; label: string; isActive: boolean } }
  | {
      kind: 'update';
      index: number;
      patch: { origin: string; label: string; isActive: boolean };
    };

type DeleteOriginTarget = {
  index: number;
  row: { origin: string; label: string; isActive: boolean };
};

type OriginPreviewStatus = 'active' | 'inactive' | 'removing';

function OriginPreviewCard({
  label,
  origin,
  statusLabel,
  statusTone = 'active',
}: {
  label: string;
  origin: string;
  statusLabel?: string;
  statusTone?: OriginPreviewStatus;
}) {
  const originLine = origin.trim() || '—';
  const badgeClass =
    statusTone === 'removing'
      ? 'bg-amber-50 text-amber-800 ring-amber-200/90'
      : statusTone === 'inactive'
        ? 'bg-slate-100 text-slate-500 ring-slate-200/90'
        : 'bg-emerald-50 text-emerald-800 ring-emerald-200/90';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200/90 bg-slate-50/50 px-3 py-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        aria-hidden
      >
        <Globe className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-medium text-slate-900">{label}</p>
        <p className="m-0 truncate font-mono text-[0.6875rem] leading-snug text-slate-500" title={originLine}>
          {originLine}
        </p>
      </div>
      {statusLabel ? (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ring-1',
            badgeClass,
          )}
        >
          {statusLabel}
        </span>
      ) : null}
    </div>
  );
}

function LiveDraftWarningOriginBody({
  warning,
  rowTitle,
}: {
  warning: LiveOriginDraftWarning;
  rowTitle: (row: { origin: string; label: string }) => string;
}) {
  const intro =
    'Your agent is live. After this change, no active allowed websites will remain, and it will move to draft. Add a website again and go live when you are ready to embed.';

  if (warning.kind === 'delete') {
    return (
      <div className="space-y-3">
        <p className={cn(ws.workspaceEditorControlHint, 'mb-4 mt-0 text-sm leading-relaxed text-slate-600')}>{intro}</p>
        <OriginPreviewCard
          label={rowTitle(warning.row)}
          origin={warning.row.origin}
          statusLabel="Removing"
          statusTone="removing"
        />
      </div>
    );
  }

  const merged = warning.patch;

  return (
    <div className="space-y-3">
      <p className={cn(ws.workspaceEditorControlHint, 'mb-4 mt-0 text-sm leading-relaxed text-slate-600')}>{intro}</p>
      <OriginPreviewCard
        label={rowTitle(merged)}
        origin={merged.origin}
        statusLabel={merged.isActive ? 'Active' : 'Inactive'}
        statusTone={merged.isActive ? 'active' : 'inactive'}
      />
    </div>
  );
}

/** Inline markers in flat setup lines: `**bold**` and `` `mono` ``. */
function renderInstallGuideFlatLine(line: string): ReactNode {
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      out.push(line.slice(last, m.index));
    }
    const raw = m[1] ?? '';
    if (raw.startsWith('**')) {
      out.push(
        <span key={k++} className="font-semibold text-slate-900">
          {raw.slice(2, -2)}
        </span>,
      );
    } else if (raw.startsWith('`')) {
      out.push(
        <code
          key={k++}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.8125rem] text-slate-800"
        >
          {raw.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + raw.length;
  }
  if (last < line.length) {
    out.push(line.slice(last));
  }
  return out.length === 0 ? line : out.length === 1 ? out[0] : <>{out}</>;
}

export function PublishSection() {
  const baseId = useId();
  const ctx = usePublishWorkspace();
  const lifecycle = useBotLifecycleControls();

  const {
    copyText,
    copiedId,
    onSubmit,
    saveError,
    status,
    rows,
    updateRow,
    addRow,
    removeRow,
    visibility,
    setVisibility,
    visibilitySavingTarget,
    accessKeyDisplay,
    secretKeyDisplay,
    secretRevealed,
    setSecretRevealed,
    embedInstallMode,
    setEmbedInstallMode,
    activeValidOriginsForSelect,
    chatWidgetSnippet,
    installSnippet,
    rotatingAccessKey,
    rotatingSecretKey,
    keyActionError,
    rotateAccessKey,
    rotateSecretKey,
    activeValidOriginCount,
    saving,
    savingDeploymentMeta,
  } = ctx;

  const [originModal, setOriginModal] = useState<OriginModal>(null);
  const [deleteOriginTarget, setDeleteOriginTarget] = useState<DeleteOriginTarget | null>(null);
  const [liveDraftWarning, setLiveDraftWarning] = useState<LiveOriginDraftWarning | null>(null);
  const [liveDraftWarningSaving, setLiveDraftWarningSaving] = useState(false);
  const [originModalSaving, setOriginModalSaving] = useState(false);
  const [deleteOriginSaving, setDeleteOriginSaving] = useState(false);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);
  const [draftOrigin, setDraftOrigin] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftActive, setDraftActive] = useState(true);
  const [originFieldErrors, setOriginFieldErrors] = useState<{ origin?: string }>({});

  const resetOriginDraft = useCallback(() => {
    setDraftOrigin('');
    setDraftLabel('');
    setDraftActive(true);
    setOriginFieldErrors({});
  }, []);

  const openAddOrigin = useCallback(() => {
    if (rows.length >= MAX_ALLOWED_ORIGINS) return;
    resetOriginDraft();
    setOriginModal({ mode: 'add' });
  }, [resetOriginDraft, rows.length]);

  const openEditOrigin = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      setDraftOrigin(row.origin);
      setDraftLabel(row.label);
      setDraftActive(row.isActive);
      setOriginFieldErrors({});
      setOriginModal({ mode: 'edit', index });
    },
    [rows],
  );

  useEffect(() => {
    if (!originModal) resetOriginDraft();
  }, [originModal, resetOriginDraft]);

  const saveOriginModal = useCallback(async () => {
    const trimmed = draftOrigin.trim();
    const err: { origin?: string } = {};
    if (!trimmed) {
      err.origin = 'Enter the site URL.';
    } else if (!normalizeCustomerEmbedOrigin(trimmed)) {
      err.origin = 'Use a full URL with https:// (production domains only—localhost cannot be saved).';
    }
    if (Object.keys(err).length) {
      setOriginFieldErrors(err);
      return;
    }
    const normalized = normalizeCustomerEmbedOrigin(trimmed)!;
    const label = draftLabel.trim();
    if (originModal?.mode === 'add') {
      if (rows.length >= MAX_ALLOWED_ORIGINS) {
        setOriginFieldErrors({ origin: `You can add up to ${MAX_ALLOWED_ORIGINS} websites.` });
        return;
      }
      setOriginModalSaving(true);
      const ok = await addRow({ origin: normalized, label, isActive: draftActive });
      setOriginModalSaving(false);
      if (ok) setOriginModal(null);
      return;
    }
    if (originModal?.mode === 'edit') {
      const patch = { origin: normalized, label, isActive: draftActive };
      if (
        status === 'published' &&
        wouldLoseAllActiveOriginsAfterUpdate(rows, originModal.index, patch)
      ) {
        setLiveDraftWarning({ kind: 'update', index: originModal.index, patch });
        setOriginModal(null);
        return;
      }
      setOriginModalSaving(true);
      const ok = await updateRow(originModal.index, patch);
      setOriginModalSaving(false);
      if (ok) setOriginModal(null);
    }
  }, [draftOrigin, draftLabel, draftActive, originModal, rows, status, addRow, updateRow]);

  const confirmLiveDraftWarning = useCallback(async () => {
    if (!liveDraftWarning || liveDraftWarningSaving) return;
    setLiveDraftWarningSaving(true);
    const ok =
      liveDraftWarning.kind === 'delete'
        ? await removeRow(liveDraftWarning.index)
        : await updateRow(liveDraftWarning.index, liveDraftWarning.patch);
    setLiveDraftWarningSaving(false);
    if (ok) setLiveDraftWarning(null);
  }, [liveDraftWarning, liveDraftWarningSaving, removeRow, updateRow]);

  const requestRemoveOrigin = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      if (status === 'published' && wouldLoseAllActiveOriginsAfterRemove(rows, index)) {
        setLiveDraftWarning({ kind: 'delete', index, row });
        return;
      }
      setDeleteOriginTarget({ index, row });
    },
    [rows, status],
  );

  const confirmDeleteOrigin = useCallback(async () => {
    if (!deleteOriginTarget || deleteOriginSaving) return;
    setDeleteOriginSaving(true);
    const ok = await removeRow(deleteOriginTarget.index);
    setDeleteOriginSaving(false);
    if (ok) setDeleteOriginTarget(null);
  }, [deleteOriginTarget, deleteOriginSaving, removeRow]);

  const snippetWithDomainHint = useMemo(() => {
    if (embedInstallMode !== 'chat-widget') return installSnippet;
    const origin = activeValidOriginsForSelect[0]?.trim() ?? '';
    if (!origin) return chatWidgetSnippet;
    return `// Install on pages served from:\n// ${origin}\n\n${chatWidgetSnippet}`;
  }, [embedInstallMode, activeValidOriginsForSelect, installSnippet, chatWidgetSnippet]);

  const visibilityOptions = VISIBILITY_CHOICE_OPTIONS;

  const embedTypeOptions: { value: EmbedInstallMode; label: string; hint: string; disabled?: boolean }[] = [
    { value: 'chat-widget', label: 'Chat widget', hint: 'Add a floating chat bubble to your website.' },
    { value: 'iframe', label: 'Iframe', hint: 'Embed the full chat panel inside a page.' },
  ];

  const installSetupGuide = useMemo(() => getInstallSetupGuide(embedInstallMode), [embedInstallMode]);
  const setupGuideLinkLabel =
    embedInstallMode === 'chat-widget' ? 'How to set up widget' : 'How to set up iframe';

  const installKeysUnlocked = activeValidOriginCount >= 1;

  function rowTitle(row: { origin: string; label: string }): string {
    const t = row.label.trim();
    if (t) return t;
    const o = row.origin.trim();
    if (!o) return 'Website';
    try {
      return new URL(o.startsWith('http') ? o : `https://${o}`).hostname;
    } catch {
      return o;
    }
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-go-live-editor>
      <form
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => void onSubmit(e)}
        aria-label="Deploy and go live settings"
      >
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>{PAGE_TITLE}</h1>
                <p className={ws.workspaceEditorLead}>
                  Allow each site that will embed the widget, then copy the install snippet and keys.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:pt-0">
              {status === 'published' ? (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className={cn(
                      ws.workspaceEditorButtonLabel,
                      'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[10rem] [&_svg]:text-white',
                    )}
                    disabled={!installKeysUnlocked}
                    onClick={() => {
                      void copyText(
                        embedInstallMode === 'chat-widget' ? snippetWithDomainHint : installSnippet,
                        'snippet',
                      );
                    }}
                    aria-label="Copy install snippet"
                    title="Copy install snippet"
                  >
                    {copiedId === 'snippet' ? (
                      <>
                        <Check size={15} strokeWidth={2.5} className="text-white" aria-hidden />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={15} strokeWidth={2} className="text-white" aria-hidden />
                        Copy snippet
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className={cn(ws.workspaceEditorButtonLabel, 'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto [&_svg]:text-white')}
                    onClick={() => lifecycle?.openDraft()}
                    aria-label="Move bot to draft"
                    title="Stop showing this bot on your allowed websites until you publish again"
                  >
                    <PencilLine size={15} strokeWidth={2} aria-hidden />
                    Move to draft
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className={cn(
                    ws.workspaceEditorButtonLabel,
                    'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[10rem] [&_svg]:text-white',
                  )}
                  disabled={!installKeysUnlocked}
                  onClick={() => lifecycle?.openPublish()}
                  aria-label="Go live to publish"
                  title="Go live to publish"
                >
                  <Rocket size={15} strokeWidth={2} className="text-white" aria-hidden />
                  Go Live
                </Button>
              )}
            </div>
          </header>

          {saveError ? (
            <div
              className={cn(
                ws.workspaceEditorBannerText,
                'mb-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[var(--color-danger-text-emphasis)]',
              )}
              role="alert"
            >
              {saveError}
            </div>
          ) : null}

          <div className={cn('min-w-0', pageSectionsClass)}>
            <Card className={standardCardClass}>
              <CardBody className="w-full min-w-0 px-5 py-6 sm:px-6 sm:py-7">
                <section className="flex min-w-0 flex-col gap-4" aria-labelledby="allowed-origins-heading">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/30">
                    <div className="border-b border-slate-200/80 px-3 py-3 sm:px-4 sm:py-3.5">
                      <WorkspaceSectionHeader
                        id="allowed-origins-heading"
                        title="Allowed origins"
                        titleAddon={
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
                            {rows.length}/{MAX_ALLOWED_ORIGINS}
                          </span>
                        }
                        inlineEnd={
                          rows.length > 0 ? (
                            <Button
                              type="button"
                              variant="outlinePrimary"
                              size="sm"
                              className="shrink-0 gap-1.5"
                              disabled={rows.length >= MAX_ALLOWED_ORIGINS}
                              title={
                                rows.length >= MAX_ALLOWED_ORIGINS
                                  ? `Maximum ${MAX_ALLOWED_ORIGINS} websites`
                                  : undefined
                              }
                              onClick={openAddOrigin}
                            >
                              <Plus size={15} strokeWidth={2} aria-hidden />
                              Add origin
                            </Button>
                          ) : null
                        }
                        description="List the sites where the widget will be used (up to 3). The browser only loads the widget on URLs you add here."
                      />
                    </div>

                    {rows.length === 0 ? (
                      <div className="flex flex-col items-center px-3 py-12 text-center sm:px-4">
                        <p className="m-0 text-sm font-semibold text-slate-800">No websites yet</p>
                        <p className={cn(ws.workspaceEditorControlHint, 'mx-auto mt-2 max-w-sm text-pretty text-sm text-slate-600')}>
                          Add at least one production site where visitors will open the chat. Use the full address, e.g.{' '}
                          <span className="font-mono text-[0.6875rem] text-slate-700">https://www.example.com</span>
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          className={cn(ws.workspaceEditorButtonLabel, 'mt-6 gap-1.5 px-6 shadow-sm')}
                          onClick={openAddOrigin}
                        >
                          <Plus size={16} strokeWidth={2} aria-hidden />
                          Add origin
                        </Button>
                      </div>
                    ) : (
                      <ul className="m-0 list-none divide-y divide-slate-200/80 p-0" role="list" aria-label="Allowed origins">
                        {rows.map((row, index) => {
                          const label = rowTitle(row);
                          const originLine = row.origin.trim() || '—';
                          return (
                            <li key={row.clientId} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                              <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                                aria-hidden
                              >
                                <Globe className="h-4 w-4" strokeWidth={2} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="m-0 truncate text-sm font-medium text-slate-900">{label}</p>
                                <p className="m-0 truncate text-xs leading-snug text-slate-500" title={originLine}>
                                  {originLine}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'hidden shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ring-1 sm:inline-flex',
                                  row.isActive
                                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/90'
                                    : 'bg-slate-100 text-slate-500 ring-slate-200/90',
                                )}
                              >
                                {row.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                                  aria-label={`Edit ${label}`}
                                  onClick={() => openEditOrigin(index)}
                                >
                                  <Pencil size={16} strokeWidth={1.75} aria-hidden />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-[var(--color-danger-text-emphasis)]"
                                  aria-label={`Remove ${label}`}
                                  onClick={() => requestRemoveOrigin(index)}
                                >
                                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>
              </CardBody>
            </Card>

            <Card className={standardCardClass}>
              <CardBody className="w-full min-w-0 px-5 py-6 sm:px-6 sm:py-7">
                <div className="relative min-h-[28rem]">
                  <section
                    className={cn(
                      'flex min-w-0 flex-col gap-6',
                      !installKeysUnlocked && 'pointer-events-none select-none',
                    )}
                    aria-labelledby="install-api-keys-heading"
                    aria-disabled={!installKeysUnlocked || undefined}
                  >
                    <WorkspaceSectionHeader
                      id="install-api-keys-heading"
                      title="Widget Setup"
                      description="Choose chat widget or iframe, set visibility, then copy the install code and keys."
                      inlineEnd={
                        <button
                          type="button"
                          className="cursor-pointer text-sm font-medium text-[var(--color-teal-600)] underline underline-offset-2 hover:text-[var(--color-teal-700)]"
                          onClick={() => setSetupGuideOpen(true)}
                        >
                          {setupGuideLinkLabel}
                        </button>
                      }
                    />

                    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                      <div className="relative flex min-w-0 flex-col gap-6">
                        <ChoiceCardGroup
                          name="Install method"
                          subtitle="Widget or iframe for allowed sites. Hosted preview: Share bot preview (top bar)."
                          value={embedInstallMode}
                          options={embedTypeOptions}
                          onChange={setEmbedInstallMode}
                        />

                        <ChoiceCardGroup
                          name="Visibility"
                          subtitle={VISIBILITY_CHOICE_SUBTITLE}
                          value={visibilitySavingTarget ?? visibility}
                          options={visibilityOptions}
                          onChange={setVisibility}
                          savingTarget={visibilitySavingTarget}
                        />

                        {savingDeploymentMeta && !visibilitySavingTarget ? (
                          <WidgetSetupChoicesSavingOverlay />
                        ) : null}

                        <div
                          className="flex gap-2.5 rounded-lg border border-orange-200/90 bg-orange-50/90 px-3 py-2.5 text-sm text-orange-950"
                          role="status"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" strokeWidth={2} aria-hidden />
                          <p className="m-0 leading-snug">
                            <span className="font-semibold text-orange-900">Keep keys safe</span> — treat access and secret keys like passwords; never expose them in public repos or client-side code you don’t control. In server-side setups, store keys in environment variables whenever possible.
                          </p>
                        </div>

                      </div>

                      <div className="flex min-w-0 flex-col gap-6">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className={cn(ws.workspaceEditorSubsectionTitle, 'm-0')}>Install code</p>
                              <p className={cn(ws.workspaceEditorHelperText, 'm-0 mt-1')}>
                                {embedInstallMode === 'iframe'
                                  ? 'Paste this iframe on an allowed site. For Top Pages analytics, include parentPageUrl in the iframe URL when you can (see setup guide).'
                                  : 'Paste this code on your site to add the chat widget.'}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outlinePrimary"
                              size="sm"
                              className="shrink-0 self-start sm:self-center"
                              disabled={!installKeysUnlocked}
                              onClick={() =>
                                void copyText(
                                  embedInstallMode === 'chat-widget' ? snippetWithDomainHint : installSnippet,
                                  'snippet',
                                )
                              }
                              aria-label="Copy Snippet"
                              title="Copy Snippet"
                            >
                              {copiedId === 'snippet' ? (
                                <>
                                  <Check size={15} strokeWidth={2.5} className="text-[var(--color-teal-600)]" aria-hidden />
                                  Copied
                                </>
                              ) : (
                                <>
                                  Copy Snippet
                                </>
                              )}
                            </Button>
                          </div>
                          <pre className={snippetPreClass} tabIndex={0}>
                            {embedInstallMode === 'chat-widget' ? snippetWithDomainHint : installSnippet}
                          </pre>
                        </div>

                        <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5">
                          <p className={cn(ws.workspaceEditorFieldCaption, 'mb-3')}>Access and secret keys</p>
                          {keyActionError ? (
                            <div
                              className={cn(
                                ws.workspaceEditorBannerText,
                                'mb-3 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-[var(--color-danger-text-emphasis)]',
                              )}
                              role="alert"
                            >
                              {keyActionError}
                            </div>
                          ) : null}
                          <div className="space-y-4">
                            <div>
                              <label className={cn(ws.workspaceEditorHelperText, 'mb-1.5 block')} htmlFor="publish-access-key">
                                Access key
                              </label>
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <Input
                                    id="publish-access-key"
                                    quiet
                                    readOnly
                                    inputSize="lg"
                                    value={accessKeyDisplay}
                                    className={readOnlyMono}
                                    revealable={false}
                                    trailingIcon={
                                      <span className="inline-flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          className={keyFieldTrailingBtn}
                                          onClick={() => void copyText(accessKeyDisplay, 'access')}
                                          aria-label="Copy access key"
                                        >
                                          {copiedId === 'access' ? (
                                            <Check size={15} strokeWidth={2.5} className="text-[var(--color-teal-600)]" aria-hidden />
                                          ) : (
                                            <Copy size={15} strokeWidth={2} aria-hidden />
                                          )}
                                        </button>
                                      </span>
                                    }
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-9 shrink-0 gap-1.5 px-2.5"
                                  disabled={rotatingAccessKey}
                                  onClick={() => void rotateAccessKey()}
                                  aria-label="Rotate access key"
                                >
                                  <RotateCw
                                    size={15}
                                    strokeWidth={2}
                                    className={cn(rotatingAccessKey && 'animate-spin')}
                                    aria-hidden
                                  />
                                  <span className="text-xs font-medium">Rotate</span>
                                </Button>
                              </div>
                            </div>

                            {visibility === 'private' ? (
                              <div className="border-t border-slate-200/80 pt-4">
                                <label className={cn(ws.workspaceEditorHelperText, 'mb-1.5 block')} htmlFor="publish-secret-key">
                                  Secret key
                                </label>
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    <Input
                                      id="publish-secret-key"
                                      quiet
                                      readOnly
                                      inputSize="lg"
                                      type={secretRevealed ? 'text' : 'password'}
                                      value={secretKeyDisplay}
                                      autoComplete="off"
                                      className={readOnlyMono}
                                      revealable={false}
                                      trailingIcon={
                                        <span className="inline-flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            className={keyFieldTrailingBtn}
                                            onClick={() => setSecretRevealed(!secretRevealed)}
                                            aria-label={secretRevealed ? 'Hide secret key' : 'Reveal secret key'}
                                          >
                                            {secretRevealed ? (
                                              <EyeOff size={15} strokeWidth={2} aria-hidden />
                                            ) : (
                                              <Eye size={15} strokeWidth={2} aria-hidden />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            className={keyFieldTrailingBtn}
                                            onClick={() => void copyText(secretKeyDisplay, 'secret')}
                                            aria-label="Copy secret key"
                                          >
                                            {copiedId === 'secret' ? (
                                              <Check size={15} strokeWidth={2.5} className="text-[var(--color-teal-600)]" aria-hidden />
                                            ) : (
                                              <Copy size={15} strokeWidth={2} aria-hidden />
                                            )}
                                          </button>
                                        </span>
                                      }
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-9 shrink-0 gap-1.5 px-2.5"
                                    disabled={rotatingSecretKey}
                                    onClick={() => void rotateSecretKey()}
                                    aria-label="Rotate secret key"
                                  >
                                    <RotateCw
                                      size={15}
                                      strokeWidth={2}
                                      className={cn(rotatingSecretKey && 'animate-spin')}
                                      aria-hidden
                                    />
                                    <span className="text-xs font-medium">Rotate</span>
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <FeStackTags embedInstallMode={embedInstallMode} />
                  </section>

                  {!installKeysUnlocked ? (
                    <InstallApiKeysLockedOverlay>
                      <>
                        Add at least one <span className="font-medium text-slate-700">active allowed origin</span> in
                        the section above. The widget only runs on active websites you list there.
                      </>
                    </InstallApiKeysLockedOverlay>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </form>

      <Modal
        open={setupGuideOpen}
        onClose={() => setSetupGuideOpen(false)}
        title={installSetupGuide.title}
        description={installSetupGuide.description}
        size="lg"
        footer={
          <Button type="button" variant="primary" size="lg" onClick={() => setSetupGuideOpen(false)}>
            Got it
          </Button>
        }
      >
        <ol className="m-0 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {installSetupGuide.lines.map((line) => (
            <li key={line}>{renderInstallGuideFlatLine(line)}</li>
          ))}
        </ol>
      </Modal>

      <Modal
        open={originModal !== null}
        onClose={() => {
          if (originModalSaving) return;
          setOriginModal(null);
        }}
        allowDismiss={!originModalSaving}
        title={originModal?.mode === 'edit' ? 'Edit website' : 'Add website'}
        description="Production HTTPS URL only. Localhost cannot be saved."
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setOriginModal(null)}
              disabled={originModalSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={originModalSaving}
              aria-busy={originModalSaving}
              onClick={() => void saveOriginModal()}
              aria-label="Save website to allowed origins"
            >
              <ModalButtonLabel loading={originModalSaving} savingLabel="Saving…">
                Save website
              </ModalButtonLabel>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldRow
            label="Website URL"
            htmlFor={`${baseId}-origin-url`}
            className="gap-1.5"
            helperText={originFieldErrors.origin ? undefined : 'Example: https://www.example.com'}
            error={originFieldErrors.origin}
          >
            <Input
              id={`${baseId}-origin-url`}
              quiet
              value={draftOrigin}
              onChange={(e) => {
                setDraftOrigin(e.target.value);
                if (originFieldErrors.origin) setOriginFieldErrors({});
              }}
              placeholder="https://www.example.com"
              autoComplete="off"
              invalid={Boolean(originFieldErrors.origin)}
              disabled={originModalSaving}
            />
          </FieldRow>
          <FieldRow label="Label (optional)" htmlFor={`${baseId}-origin-label`} className="gap-1.5" helperText="Shown in your list only.">
            <Input
              id={`${baseId}-origin-label`}
              quiet
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="Marketing site"
              autoComplete="off"
              disabled={originModalSaving}
            />
          </FieldRow>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2.5">
            <span id={`${baseId}-origin-active`} className={cn(ws.workspaceEditorControlLabel, 'm-0')}>
              Allowed for this origin
            </span>
            <Switch
              checked={draftActive}
              onCheckedChange={setDraftActive}
              aria-labelledby={`${baseId}-origin-active`}
              disabled={originModalSaving}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={liveDraftWarning !== null}
        onClose={() => {
          if (liveDraftWarningSaving) return;
          setLiveDraftWarning(null);
        }}
        allowDismiss={!liveDraftWarningSaving}
        tone="warning"
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            Move agent to draft?
          </span>
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setLiveDraftWarning(null)}
              disabled={liveDraftWarningSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={liveDraftWarningSaving}
              aria-busy={liveDraftWarningSaving}
              onClick={() => void confirmLiveDraftWarning()}
            >
              <ModalButtonLabel loading={liveDraftWarningSaving} savingLabel="Confirming…">
                Confirm
              </ModalButtonLabel>
            </Button>
          </>
        }
      >
        {liveDraftWarning ? (
          <LiveDraftWarningOriginBody warning={liveDraftWarning} rowTitle={rowTitle} />
        ) : null}
      </Modal>

      <Modal
        open={deleteOriginTarget !== null}
        onClose={() => {
          if (deleteOriginSaving) return;
          setDeleteOriginTarget(null);
        }}
        allowDismiss={!deleteOriginSaving}
        tone="danger"
        title="Remove website?"
        description="Visitors on this origin will no longer be able to load the widget if it was the only match."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setDeleteOriginTarget(null)}
              disabled={deleteOriginSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              disabled={deleteOriginSaving}
              aria-busy={deleteOriginSaving}
              onClick={() => void confirmDeleteOrigin()}
            >
              <ModalButtonLabel loading={deleteOriginSaving} savingLabel="Removing…">
                Remove
              </ModalButtonLabel>
            </Button>
          </>
        }
      >
        <p className={cn(ws.workspaceEditorControlHint, 'm-0 text-sm')}>
          {deleteOriginTarget ? (
            <>
              <span className="font-medium text-slate-800">{rowTitle(deleteOriginTarget.row)}</span>
              {deleteOriginTarget.row.origin.trim() ? (
                <span className="mt-1 block truncate text-slate-600">{deleteOriginTarget.row.origin.trim()}</span>
              ) : null}
            </>
          ) : null}
        </p>
      </Modal>
    </div>
  );
}
