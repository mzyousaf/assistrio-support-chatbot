import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Clock, Copy, ExternalLink, Link2, Loader2 } from 'lucide-react';
import type { CustomerBotDetail, CustomerShareLinkResponse, CustomerShareLinkStatus } from '@/api/types';
import {
  disableSharePreview,
  enableSharePreview,
  getCustomerBotShareLink,
  patchSharePreviewEnabled,
  regenerateSharePreviewToken,
  revokeSharePreview,
} from '@/api/customerApi';
import { Modal } from '@/components/ui/Modal';
import { Button, Input, Select } from '@/components/ui';
import { Switch } from '@/components/ui/Switch';
import { appToast } from '@/lib/app-toast';
import { PaidPlanFeatureCalloutForReason } from '@/components/billing/PaidPlanFeatureCallout';
import { useUpgradePlanModal } from '@/components/billing/UpgradePlanModalProvider';
import { mapPlanLimitErrorCodeToUpgradeReason } from '@/lib/planLimitError';
import {
  SHARE_PREVIEW_DEFAULT_EXPIRES_HOURS,
  SHARE_PREVIEW_EXPIRES_HOURS_OPTIONS,
  buildSharePreviewUrl,
  formatSharePreviewLifeSpan,
  type SharePreviewLifeSpanInfo,
} from '@/lib/sharePreview';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  botId: string;
  bot: CustomerBotDetail | null;
  agentStatus: 'draft' | 'published';
  sharePreviewAllowed?: boolean;
  onRefresh: () => Promise<void>;
  onShareUpdated?: (share: CustomerShareLinkResponse) => void;
};

type LoadingAction = 'create' | 'regenerate' | 'disable' | 'enable' | 'revoke' | null;

type ModalPhase = 'not_created' | 'active' | 'expired' | 'disabled' | 'needs_secure' | 'revoked';

const cardShell = cn(
  'rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04]',
  'sm:p-5',
);

const innerWell = cn('rounded-lg border border-slate-200/80 bg-slate-50/90 p-2 sm:p-2.5');

const regeneratePanelClass = cn(
  'rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]',
);

function botShareChatToLinkResponse(share: CustomerBotDetail['shareChat'] | undefined): CustomerShareLinkResponse | null {
  if (!share || typeof share !== 'object') return null;
  const slug = typeof share.slug === 'string' ? share.slug.trim().toLowerCase() : '';
  const tokenRevokedAt =
    typeof share.tokenRevokedAt === 'string' && share.tokenRevokedAt.trim()
      ? share.tokenRevokedAt.trim()
      : share.tokenRevokedAt === null
        ? null
        : undefined;

  if (tokenRevokedAt) {
    return {
      enabled: share.enabled === true,
      slug,
      expiresAt: share.expiresAt ?? null,
      tokenRevokedAt,
      allowDraft: share.allowDraft === true,
      requiresPreviewToken: true,
      secureSharePreviewConfigured: false,
      status: 'revoked',
    };
  }

  if (!slug) {
    return {
      enabled: share.enabled === true,
      slug: '',
      expiresAt: share.expiresAt ?? null,
      allowDraft: share.allowDraft === true,
      requiresPreviewToken: true,
      secureSharePreviewConfigured: false,
      status: 'not_created',
    };
  }

  const secure = share.secureSharePreviewConfigured === true;
  const lifeSpan = formatSharePreviewLifeSpan(share.expiresAt ?? null);
  if (!secure) {
    return {
      enabled: share.enabled === true,
      slug,
      expiresAt: share.expiresAt ?? null,
      allowDraft: share.allowDraft === true,
      requiresPreviewToken: true,
      secureSharePreviewConfigured: false,
      status: 'missing',
    };
  }

  let status: CustomerShareLinkStatus;
  if (lifeSpan.state === 'expired') status = 'expired';
  else if (!share.enabled) status = 'disabled';
  else status = 'active';

  return {
    enabled: share.enabled === true,
    slug,
    expiresAt: share.expiresAt ?? null,
    allowDraft: share.allowDraft === true,
    requiresPreviewToken: true,
    secureSharePreviewConfigured: true,
    status,
  };
}

function LifetimeSelect({
  id,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string;
  value: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('mt-3', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Link lifetime
      </label>
      <Select
        id={id}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full max-w-[12rem]"
        triggerClassName="h-8 min-h-8 w-full border-slate-200 text-[0.8125rem] leading-tight shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/20"
      >
        {SHARE_PREVIEW_EXPIRES_HOURS_OPTIONS.map((o) => (
          <option key={o.hours} value={String(o.hours)}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function StatusPill({ phase }: { phase: ModalPhase }) {
  const styles: Record<ModalPhase, { label: string; className: string }> = {
    not_created: {
      label: 'Not created',
      className: 'border-slate-200/90 bg-slate-100 text-slate-700',
    },
    active: {
      label: 'Active',
      className: 'border-emerald-200/90 bg-emerald-50 text-emerald-900',
    },
    expired: {
      label: 'Expired',
      className: 'border-amber-200/90 bg-amber-50 text-amber-950',
    },
    disabled: {
      label: 'Disabled',
      className: 'border-slate-200/90 bg-slate-100 text-slate-700',
    },
    needs_secure: {
      label: 'Update needed',
      className: 'border-amber-200/90 bg-amber-50 text-amber-950',
    },
    revoked: {
      label: 'Revoked',
      className: 'border-red-200/90 bg-red-50 text-red-900',
    },
  };
  const s = styles[phase];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}

function InfoCheck({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" strokeWidth={2.25} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function ShareUrlRow({
  value,
  canInteract,
  loadingAction,
  copyJustSucceeded,
  onCopy,
  onOpen,
  unframed,
}: {
  value: string;
  canInteract: boolean;
  loadingAction: LoadingAction;
  /** Brief success state: check icon + “Copied”. */
  copyJustSucceeded: boolean;
  onCopy: () => void;
  onOpen: () => void;
  /** Omit border/padding around the URL row (e.g. under “Preview link”). */
  unframed?: boolean;
}) {
  return (
    <div className={unframed ? 'min-w-0' : innerWell}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
        <Input
          readOnly
          disabled
          quiet
          value={value}
          placeholder="—"
          className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[13px] leading-snug text-slate-800 shadow-none focus-visible:ring-0 disabled:cursor-default disabled:text-slate-800"
          inputSize="sm"
          aria-label="Share agent preview URL"
        />
        <div className="flex shrink-0 gap-2 sm:items-center">
          <Button
            type="button"
            variant="outlinePrimary"
            size="md"
            className="h-8 w-8 shrink-0 gap-0 p-0"
            disabled={Boolean(loadingAction) || !canInteract}
            onClick={() => void onCopy()}
            aria-live="polite"
            title={copyJustSucceeded ? 'Copied' : 'Copy link'}
            aria-label={copyJustSucceeded ? 'Copied to clipboard' : 'Copy share link'}
          >
            {copyJustSucceeded ? (
              <Check className="h-4 w-4 shrink-0 text-[var(--color-teal-700)]" strokeWidth={2.5} aria-hidden />
            ) : (
              <Copy className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="h-8 w-8 shrink-0 gap-0 p-0"
            disabled={Boolean(loadingAction) || !canInteract}
            onClick={onOpen}
            title="Open in new tab"
            aria-label="Open share link in new tab"
          >
            <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExpiryBlock({ lifeSpan }: { lifeSpan: SharePreviewLifeSpanInfo }) {
  const isExpired = lifeSpan.state === 'expired';
  const isMissing = lifeSpan.state === 'missing';
  const detailTitle =
    lifeSpan.state === 'active' && lifeSpan.detailTooltip ? `Ends: ${lifeSpan.detailTooltip}` : undefined;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 sm:px-4',
        isExpired && 'border-amber-200/70 bg-amber-50/40',
        !isExpired && 'border-slate-100 bg-slate-50/80',
        isMissing && 'border-slate-200/80 bg-slate-50/60',
      )}
      title={detailTitle}
    >
      <Clock
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          isExpired && 'text-amber-700',
          !isExpired && !isMissing && 'text-teal-600/90',
          isMissing && 'text-slate-400',
        )}
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {isExpired ? 'Ended' : isMissing ? 'Expiry' : 'Time remaining'}
        </p>
        <p
          className={cn(
            'mt-0.5 m-0 text-sm leading-snug',
            isExpired && 'font-medium text-amber-950',
            !isExpired && 'font-medium text-slate-900',
          )}
        >
          {lifeSpan.label}
          {lifeSpan.state === 'active' && lifeSpan.detailTooltip ? (
            <span className="sr-only">{` Ends ${lifeSpan.detailTooltip}`}</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export function SharePreviewModal({
  open,
  onClose,
  botId,
  bot,
  agentStatus: _agentStatus,
  sharePreviewAllowed = true,
  onRefresh,
  onShareUpdated,
}: Props) {
  void _agentStatus;
  const { openUpgradeModal } = useUpgradePlanModal();
  const controlsLocked = !sharePreviewAllowed;
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [localShare, setLocalShare] = useState<CustomerShareLinkResponse | null>(null);
  const [lastGeneratedPreviewToken, setLastGeneratedPreviewToken] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [linkLifetimeHours, setLinkLifetimeHours] = useState(SHARE_PREVIEW_DEFAULT_EXPIRES_HOURS);
  const [regeneratePanelOpen, setRegeneratePanelOpen] = useState(false);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [copyLinkFeedback, setCopyLinkFeedback] = useState(false);
  const copyFeedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareFromBot = useMemo(() => botShareChatToLinkResponse(bot?.shareChat), [bot?.shareChat]);
  const effectiveShare = localShare ?? shareFromBot;

  const applySharePayload = useCallback(
    (result: CustomerShareLinkResponse) => {
      const inferredConfigured =
        result.status === 'active' || result.status === 'disabled' || result.status === 'expired';
      const merged: CustomerShareLinkResponse = {
        ...result,
        secureSharePreviewConfigured:
          typeof result.secureSharePreviewConfigured === 'boolean'
            ? result.secureSharePreviewConfigured
            : inferredConfigured,
        requiresPreviewToken: true,
      };
      setLocalShare(merged);
      const pt = result.previewToken;
      if (typeof pt === 'string' && pt.trim()) setLastGeneratedPreviewToken(pt.trim());
      else if (pt === null) setLastGeneratedPreviewToken(null);
      onShareUpdated?.(merged);
    },
    [onShareUpdated],
  );

  useEffect(() => {
    if (!open) {
      setLocalShare(null);
      setLastGeneratedPreviewToken(null);
      setInlineError(null);
      setLoadingAction(null);
      setRegeneratePanelOpen(false);
      setLinkLifetimeHours(SHARE_PREVIEW_DEFAULT_EXPIRES_HOURS);
      setShareLinkLoading(false);
      setRevokeConfirmOpen(false);
      setCopyLinkFeedback(false);
      if (copyFeedbackClearRef.current) {
        clearTimeout(copyFeedbackClearRef.current);
        copyFeedbackClearRef.current = null;
      }
      return;
    }
    if (!botId) return;
    let cancelled = false;
    setShareLinkLoading(true);
    void getCustomerBotShareLink(botId).then((res) => {
      if (cancelled) return;
      setShareLinkLoading(false);
      if (res.ok) {
        applySharePayload(res.data);
      } else {
        setInlineError(res.error || 'Could not load share preview link.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, botId, applySharePayload]);

  const slug = typeof effectiveShare?.slug === 'string' ? effectiveShare.slug.trim().toLowerCase() : '';
  const hasSlug = Boolean(slug);
  const enabled = effectiveShare?.enabled === true;
  const secureConfigured = effectiveShare?.secureSharePreviewConfigured === true;

  const resolvedExpiresAt = effectiveShare?.expiresAt;

  const lifeSpan: SharePreviewLifeSpanInfo = useMemo(
    () => formatSharePreviewLifeSpan(resolvedExpiresAt ?? null),
    [resolvedExpiresAt],
  );

  const isExpired = lifeSpan.state === 'expired';

  const phase: ModalPhase = useMemo(() => {
    const st = effectiveShare?.status;
    if (st === 'revoked') return 'revoked';
    if (st === 'missing') return 'needs_secure';
    if (st === 'not_created') return 'not_created';
    if (st === 'expired') return 'expired';
    if (st === 'disabled') return 'disabled';
    if (st === 'active') return 'active';
    if (!effectiveShare) return 'not_created';
    if (!hasSlug) return 'not_created';
    if (!secureConfigured) return 'needs_secure';
    if (isExpired) return 'expired';
    if (!enabled) return 'disabled';
    return 'active';
  }, [effectiveShare, enabled, hasSlug, secureConfigured, isExpired]);

  const previewTokenForUrl =
    lastGeneratedPreviewToken?.trim() || effectiveShare?.previewToken?.trim() || '';

  const displayUrl = useMemo(() => {
    if (!slug || !secureConfigured) return '';
    return buildSharePreviewUrl({ slug, previewToken: previewTokenForUrl }) ?? '';
  }, [slug, secureConfigured, previewTokenForUrl]);

  const hasFullUrl = Boolean(displayUrl.trim());
  const missingTokenUi =
    enabled && !isExpired && secureConfigured && !previewTokenForUrl.trim() && lifeSpan.state === 'active';

  const modalDescription = useMemo(() => {
    if (phase === 'not_created' || phase === 'revoked') {
      return (
        <span className="text-sm leading-relaxed text-slate-500">
          Choose how long this Assistrio-hosted preview link should work. Anyone with the full link can open the
          chatbot preview until it expires.
        </span>
      );
    }
    return (
      <span className="text-sm leading-relaxed text-slate-500">
        Share a time-limited link so others can try your agent in the browser. Separate from website embeds and
        publishing—only this link and its token control who can open the preview.
      </span>
    );
  }, [phase]);

  const managePreviewLink = phase === 'active' || phase === 'disabled' || phase === 'expired';
  const urlActionsOk = hasFullUrl && phase !== 'expired';

  const copyUrl = useCallback(async () => {
    const u = displayUrl.trim();
    if (!u) return;
    if (copyFeedbackClearRef.current) {
      clearTimeout(copyFeedbackClearRef.current);
      copyFeedbackClearRef.current = null;
    }
    try {
      await navigator.clipboard.writeText(u);
      setCopyLinkFeedback(true);
      copyFeedbackClearRef.current = setTimeout(() => {
        setCopyLinkFeedback(false);
        copyFeedbackClearRef.current = null;
      }, 2000);
    } catch {
      setInlineError('Could not copy to clipboard.');
    }
  }, [displayUrl]);

  const openPreview = useCallback(() => {
    const u = displayUrl.trim();
    if (!u) return;
    window.open(u, '_blank', 'noopener,noreferrer');
  }, [displayUrl]);

  const handleCreate = useCallback(async () => {
    if (!botId || loadingAction) return;
    if (controlsLocked) {
      openUpgradeModal({ reason: 'share_preview' });
      return;
    }
    setInlineError(null);
    setLoadingAction('create');
    const res = await enableSharePreview(botId, { expiresInHours: linkLifetimeHours });
    setLoadingAction(null);
    if (!res.ok) {
      const reason = mapPlanLimitErrorCodeToUpgradeReason(res.errorCode);
      if (reason) openUpgradeModal({ reason, errorCode: res.errorCode });
      setInlineError(res.error || 'Could not create preview link.');
      return;
    }
    const result = res.data;
    if (result.enabled && !result.slug?.trim()) {
      setInlineError('Share preview was created but no slug was returned. Please refresh or regenerate the link.');
      return;
    }
    applySharePayload(result);
    setRegeneratePanelOpen(false);
    appToast.success('Preview link ready');
    void onRefresh();
  }, [botId, loadingAction, controlsLocked, linkLifetimeHours, applySharePayload, onRefresh, openUpgradeModal]);

  const handleEnabledSwitch = useCallback(
    async (turnOn: boolean) => {
      if (!botId || loadingAction) return;
      if (controlsLocked && turnOn) {
        openUpgradeModal({ reason: 'share_preview' });
        return;
      }
      setInlineError(null);
      if (turnOn) {
        setLoadingAction('enable');
        const res = await patchSharePreviewEnabled(botId, true);
        setLoadingAction(null);
        if (!res.ok) {
          const reason = mapPlanLimitErrorCodeToUpgradeReason(res.errorCode);
          if (reason) openUpgradeModal({ reason, errorCode: res.errorCode });
          setInlineError(res.error || 'Could not enable preview link.');
          return;
        }
        applySharePayload(res.data);
        appToast.success('Preview link enabled');
        void onRefresh();
      } else {
        setLoadingAction('disable');
        const res = await disableSharePreview(botId);
        setLoadingAction(null);
        if (!res.ok) {
          setInlineError(res.error || 'Could not disable preview link.');
          return;
        }
        applySharePayload(res.data);
        appToast.success('Preview link disabled');
        void onRefresh();
      }
    },
    [botId, loadingAction, controlsLocked, applySharePayload, onRefresh, openUpgradeModal],
  );

  const handlePatchRegenerate = useCallback(async () => {
    if (!botId || loadingAction) return;
    if (controlsLocked) {
      openUpgradeModal({ reason: 'share_preview' });
      return;
    }
    setInlineError(null);
    setLoadingAction('regenerate');
    const res = await regenerateSharePreviewToken(botId, linkLifetimeHours);
    setLoadingAction(null);
    if (!res.ok) {
      const reason = mapPlanLimitErrorCodeToUpgradeReason(res.errorCode);
      if (reason) openUpgradeModal({ reason, errorCode: res.errorCode });
      setInlineError(res.error || 'Could not regenerate preview link.');
      return;
    }
    applySharePayload(res.data);
    setRegeneratePanelOpen(false);
    appToast.success('Preview link updated');
    void onRefresh();
  }, [botId, loadingAction, controlsLocked, linkLifetimeHours, applySharePayload, onRefresh, openUpgradeModal]);

  const handleConfirmRevoke = useCallback(async () => {
    if (!botId || loadingAction) return;
    setInlineError(null);
    setLoadingAction('revoke');
    const res = await revokeSharePreview(botId);
    setLoadingAction(null);
    setRevokeConfirmOpen(false);
    if (!res.ok) {
      setInlineError(res.error || 'Could not revoke preview link.');
      return;
    }
    applySharePayload(res.data);
    setRegeneratePanelOpen(false);
    appToast.success('Preview link revoked');
    void onRefresh();
  }, [botId, loadingAction, applySharePayload, onRefresh]);

  const creating = loadingAction === 'create';
  const regenerating = loadingAction === 'regenerate';
  const revoking = loadingAction === 'revoke';
  const toggling = loadingAction === 'disable' || loadingAction === 'enable';

  const canCopyOpen = urlActionsOk && !missingTokenUi && !controlsLocked;
  const switchChecked = enabled && !isExpired;
  const showCreateIntro = (phase === 'not_created' && !hasSlug) || phase === 'revoked';
  const actionDisabled = Boolean(loadingAction) || controlsLocked;

  const renderRegeneratePanel = (lifetimeSelectId: string) => (
    <>
      <p className="m-0 text-sm leading-relaxed text-slate-700">
        Regenerating creates a new secure token and expiry. Previous links will stop working.
      </p>
      <LifetimeSelect
        id={lifetimeSelectId}
        value={linkLifetimeHours}
        onChange={setLinkLifetimeHours}
        disabled={actionDisabled}
        className="mt-3"
      />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={actionDisabled}
          onClick={() => setRegeneratePanelOpen(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={actionDisabled}
          onClick={() => void handlePatchRegenerate()}
        >
          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Regenerate secure link
        </Button>
      </div>
    </>
  );

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 text-lg font-semibold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-600/15">
              <Link2 className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 shrink-0">Share Agent Preview</span>
            {managePreviewLink ? (
              <span className="inline-flex shrink-0 items-center gap-2">
                <Switch
                  id="share-preview-enabled"
                  checked={switchChecked}
                  disabled={actionDisabled || isExpired}
                  onCheckedChange={(next) => void handleEnabledSwitch(next)}
                  aria-label="Allow access with the shared preview link"
                  title={switchChecked ? 'Preview link is active' : 'Preview link is paused'}
                />
                {toggling ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-600" aria-hidden /> : null}
              </span>
            ) : null}
          </span>
          {!managePreviewLink && phase !== 'revoked' ? <StatusPill phase={phase} /> : null}
        </span>
      }
      description={modalDescription}
      size="lg"
      closeOnBackdropClick
      titleClassName="!text-lg"
    >
      <div className="space-y-4">
        {controlsLocked ? (
          <PaidPlanFeatureCalloutForReason reason="share_preview" compact />
        ) : null}
        {inlineError ? (
          <div
            className="rounded-xl border border-red-200/90 bg-red-50 px-3.5 py-2.5 text-sm leading-relaxed text-red-900"
            role="alert"
          >
            {inlineError}
          </div>
        ) : null}

        {shareLinkLoading ? (
          <div className="flex justify-center py-14" aria-busy="true" aria-label="Loading share preview">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden />
          </div>
        ) : null}

        {!shareLinkLoading && showCreateIntro ? (
          <div className={phase === 'revoked' ? 'space-y-4' : cardShell}>
            <h3 className="m-0 text-base font-semibold text-slate-900">
              {phase === 'revoked' ? 'Create a new secure preview link' : 'Create secure preview link'}
            </h3>
            {phase === 'revoked' ? (
              <p className="mt-1.5 m-0 text-sm text-slate-600">
                This preview link was revoked. People with the old URL can no longer open it.
              </p>
            ) : (
              <p className="mt-1.5 m-0 text-sm text-slate-500">A tokenized link that expires on your schedule.</p>
            )}
            <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
              <InfoCheck>Secure token required</InfoCheck>
              <InfoCheck>Expires automatically</InfoCheck>
              <InfoCheck>Does not publish your chatbot</InfoCheck>
              <InfoCheck>No access or secret keys exposed</InfoCheck>
            </ul>
            <LifetimeSelect
              id="share-preview-lifetime-create"
              value={linkLifetimeHours}
              onChange={setLinkLifetimeHours}
              disabled={actionDisabled}
              className="mt-4"
            />
            <div
              className={cn(
                'flex flex-wrap justify-end gap-2',
                phase === 'revoked' ? 'mt-4' : 'mt-5',
              )}
            >
              {phase !== 'revoked' ? (
                <Button type="button" variant="secondary" size="md" disabled={Boolean(loadingAction)} onClick={onClose}>
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                variant="primary"
                size="md"
                className="gap-1.5"
                disabled={actionDisabled}
                onClick={() => void handleCreate()}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Create secure preview link
              </Button>
            </div>
          </div>
        ) : null}

        {!shareLinkLoading && phase === 'needs_secure' ? (
          <div
            className={cn(
              'rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-amber-50/40 p-4 shadow-sm ring-1 ring-amber-900/[0.06]',
              'sm:p-5',
            )}
          >
            <h3 className="m-0 text-base font-semibold text-amber-950">Secure link required</h3>
            <p className="mt-2 m-0 text-sm leading-relaxed text-amber-950/85">
              Regenerate this preview link to create a secure, expiring URL.
            </p>
            <LifetimeSelect
              id="share-preview-lifetime-needs-secure"
              value={linkLifetimeHours}
              onChange={setLinkLifetimeHours}
              disabled={actionDisabled}
              className="mt-4"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={actionDisabled}
                onClick={() => void handlePatchRegenerate()}
              >
                {regenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Regenerate secure link
              </Button>
            </div>
          </div>
        ) : null}

        {!shareLinkLoading && managePreviewLink ? (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 gap-y-1">
                <h3 className="m-0 text-base font-semibold text-slate-900">Preview link</h3>
                <StatusPill phase={phase} />
              </div>
              <p className="mt-0.5 m-0 text-xs text-slate-500">Same URL when you turn access back on.</p>
            </div>

            {isExpired ? (
              <div className="space-y-4">
                <div
                  className={cn(
                    'rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-3 sm:px-4',
                    'text-sm leading-relaxed text-amber-950',
                  )}
                >
                  This preview link has expired. Regenerate it to create a new secure link.
                </div>
                {hasFullUrl ? (
                  <ShareUrlRow
                    value={displayUrl}
                    canInteract={false}
                    loadingAction={loadingAction}
                    copyJustSucceeded={copyLinkFeedback}
                    onCopy={copyUrl}
                    onOpen={openPreview}
                    unframed
                  />
                ) : null}
                <LifetimeSelect
                  id="share-preview-lifetime-expired"
                  value={linkLifetimeHours}
                  onChange={setLinkLifetimeHours}
                  disabled={actionDisabled}
                  className="mt-0"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={actionDisabled}
                    onClick={() => void handlePatchRegenerate()}
                  >
                    {regenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Regenerate secure link
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    disabled={actionDisabled}
                    onClick={() => setRevokeConfirmOpen(true)}
                  >
                    Revoke link
                  </Button>
                </div>
              </div>
            ) : !enabled ? (
              <div className="space-y-4">
                <p className="m-0 text-sm leading-relaxed text-slate-600">
                  This preview link is disabled. People with the link cannot open it until you enable it again.
                </p>
                {lifeSpan.state === 'active' ? <ExpiryBlock lifeSpan={lifeSpan} /> : null}
                {hasFullUrl ? (
                  <ShareUrlRow
                    value={displayUrl}
                    canInteract={urlActionsOk && !actionDisabled}
                    loadingAction={loadingAction}
                    copyJustSucceeded={copyLinkFeedback}
                    onCopy={copyUrl}
                    onOpen={openPreview}
                    unframed
                  />
                ) : (
                  <p className="m-0 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                    This token is only shown when generated. If you need the full URL again, regenerate the link.
                  </p>
                )}
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outlinePrimary"
                      size="md"
                      className="w-fit"
                      disabled={actionDisabled}
                      onClick={() => setRegeneratePanelOpen((o) => !o)}
                    >
                      {regeneratePanelOpen ? 'Hide regenerate' : 'Regenerate link'}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      disabled={actionDisabled}
                      onClick={() => setRevokeConfirmOpen(true)}
                    >
                      Revoke link
                    </Button>
                  </div>
                  {regeneratePanelOpen ? (
                    <div className={regeneratePanelClass}>{renderRegeneratePanel('share-preview-lifetime-regen-off')}</div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {missingTokenUi ? (
                  <>
                    <ExpiryBlock lifeSpan={lifeSpan} />
                    <p className="m-0 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                      This token is only shown when generated. If you need to copy the full URL again, regenerate the
                      link.
                    </p>
                    <Button
                      type="button"
                      variant="outlinePrimary"
                      size="md"
                      className="w-fit"
                      disabled={actionDisabled}
                      onClick={() => setRegeneratePanelOpen((o) => !o)}
                    >
                      {regeneratePanelOpen ? 'Hide regenerate' : 'Regenerate link'}
                    </Button>
                    {regeneratePanelOpen ? (
                      <div className={regeneratePanelClass}>{renderRegeneratePanel('share-preview-lifetime-regen-miss')}</div>
                    ) : null}
                  </>
                ) : (
                  <ShareUrlRow
                    value={displayUrl || ''}
                    canInteract={canCopyOpen}
                    loadingAction={loadingAction}
                    copyJustSucceeded={copyLinkFeedback}
                    onCopy={copyUrl}
                    onOpen={openPreview}
                    unframed
                  />
                )}

                {!missingTokenUi ? <ExpiryBlock lifeSpan={lifeSpan} /> : null}

                {regeneratePanelOpen && !missingTokenUi ? (
                  <div className={regeneratePanelClass}>{renderRegeneratePanel('share-preview-lifetime-regen-on')}</div>
                ) : null}

                {!missingTokenUi && !regeneratePanelOpen ? (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button
                      type="button"
                      variant="outlinePrimary"
                      size="md"
                      disabled={actionDisabled}
                      onClick={() => setRegeneratePanelOpen(true)}
                    >
                      Regenerate link
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      disabled={actionDisabled}
                      onClick={() => setRevokeConfirmOpen(true)}
                    >
                      Revoke link
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>

    <Modal
      open={revokeConfirmOpen}
      onClose={() => setRevokeConfirmOpen(false)}
      title="Revoke preview link?"
      description={
        <span className="text-sm leading-relaxed text-slate-600">
          Revoking permanently invalidates the current preview link. Anyone with the old URL will lose access. To share
          again, you&apos;ll need to create a new secure preview link.
        </span>
      }
      size="md"
      closeOnBackdropClick
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={() => setRevokeConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            disabled={actionDisabled}
            onClick={() => void handleConfirmRevoke()}
          >
            {revoking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Revoke link
          </Button>
        </div>
      }
    >
      <span className="sr-only">Confirm revoke</span>
    </Modal>
    </>
  );
}
