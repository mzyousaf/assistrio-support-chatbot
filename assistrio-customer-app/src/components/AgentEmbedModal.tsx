import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Code2, PencilLine, Rocket } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCustomerBot } from '@/api/customerApi';
import type { CustomerBotDetail, CustomerBotListItem } from '@/api/types';
import { PostPublishInstallPanel } from '@/components/go-live/PostPublishInstallPanel';
import { InlineLoader } from '@/components/PageLoader';
import { Button, Modal } from '@/components/ui';
import {
  buildOnboardingChatWidgetSnippetFromInstallBot,
  buildOnboardingIframeSnippetFromInstallBot,
} from '@/onboarding/onboardingInstallSnippets';

type Props = {
  open: boolean;
  bot: CustomerBotListItem | null;
  onClose: () => void;
};

function isBotLive(bot: CustomerBotListItem | null): boolean {
  return String(bot?.status ?? '').toLowerCase() === 'published';
}

function EmbedDraftGate({ agentName }: { agentName: string }) {
  return (
    <div className="flex flex-col items-center px-1 py-2 text-center sm:py-4">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-900/[0.04]"
        aria-hidden
      >
        <PencilLine size={22} strokeWidth={2} />
      </span>
      <h3 className="mt-4 mb-0 text-base font-semibold text-slate-900">Your agent is in draft</h3>
      <p className="mt-2 mb-0 max-w-[19rem] text-sm leading-relaxed text-slate-500">
        <span className="font-medium text-slate-700">{agentName}</span> needs to be live before you can embed it on
        your site. Publish from Deploy &amp; Go Live.
      </p>
    </div>
  );
}

export function AgentEmbedModal({ open, bot, onClose }: Props) {
  const navigate = useNavigate();
  const [botDetail, setBotDetail] = useState<CustomerBotDetail | null>(null);
  const [loadingBot, setLoadingBot] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const live = isBotLive(bot);
  const agentName = bot?.name?.trim() || 'This agent';
  const deployHref = bot ? `/bots/${bot._id}/playground/deploy` : '/bots';

  useEffect(() => {
    if (!open || !bot || !live) {
      setBotDetail(null);
      setLoadError(null);
      setLoadingBot(false);
      return;
    }
    let cancelled = false;
    setLoadingBot(true);
    setLoadError(null);
    void getCustomerBot(bot._id).then((res) => {
      if (cancelled) return;
      setLoadingBot(false);
      if (!res.ok) {
        setLoadError(res.error || 'Could not load embed settings.');
        setBotDetail(null);
        return;
      }
      setBotDetail(res.data.bot);
    });
    return () => {
      cancelled = true;
    };
  }, [bot, live, open]);

  const installBot = useMemo(() => {
    if (!botDetail || !bot) return null;
    const row = botDetail;
    return {
      id: bot._id,
      name: String(row.name ?? bot.name ?? ''),
      accessKey: String(row.accessKey ?? ''),
      ...(row.visibility === 'private' && row.secretKey ? { secretKey: String(row.secretKey) } : {}),
      visibility: row.visibility === 'private' ? ('private' as const) : ('public' as const),
      allowedOrigins: Array.isArray(row.allowedOrigins) ? row.allowedOrigins : [],
    };
  }, [bot, botDetail]);

  const allowedOriginLabels = useMemo(() => {
    const rows = installBot?.allowedOrigins ?? [];
    return rows
      .filter((row) => row.isActive !== false)
      .map((row) => String(row.origin ?? '').trim())
      .filter(Boolean);
  }, [installBot]);

  const widgetSnippet = useMemo(() => {
    if (!installBot || !bot) return '';
    return buildOnboardingChatWidgetSnippetFromInstallBot(installBot, bot._id);
  }, [bot, installBot]);

  const iframeSnippet = useMemo(() => {
    if (!installBot || !bot) return '';
    return buildOnboardingIframeSnippetFromInstallBot(installBot, bot._id);
  }, [bot, installBot]);

  const modalTitle: ReactNode = (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <Code2 className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      Embed agent
    </span>
  );

  const modalDescription =
    bot && live ? (
      <div className="flex flex-col gap-2.5">
        <span className="text-slate-600">
          Choose <span className="font-medium text-slate-800">Chat widget</span> or{' '}
          <span className="font-medium text-slate-800">Iframe</span>, then copy the install snippet for{' '}
          <span className="font-medium text-slate-800">{bot.name?.trim() || 'this agent'}</span>.
        </span>
        <Link
          to={`/bots/${bot._id}/playground/deploy`}
          className="inline-flex w-fit max-w-full items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-[3px] decoration-primary/35 transition-colors hover:text-[var(--teal-800)] hover:decoration-[var(--teal-800)]/50 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          onClick={onClose}
        >
          <BookOpen size={16} strokeWidth={2} className="shrink-0 text-primary" aria-hidden />
          Install guide & embed settings
        </Link>
      </div>
    ) : undefined;

  const modalFooter =
    bot && !live ? (
      <>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            onClose();
            navigate(deployHref);
          }}
        >
          <Rocket size={14} strokeWidth={2.25} aria-hidden />
          Go Live
        </Button>
      </>
    ) : (
      <Button type="button" variant="secondary" size="sm" onClick={onClose}>
        Close
      </Button>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      size="md"
      className="max-h-[min(92vh,52rem)] max-w-md"
      bodyClassName="py-4 sm:py-5"
      footer={modalFooter}
    >
      {!bot ? null : !live ? (
        <EmbedDraftGate agentName={agentName} />
      ) : loadingBot ? (
        <InlineLoader title="Loading embed settings…" className="min-h-[11rem] py-8" />
      ) : loadError ? (
        <p className="m-0 text-[0.8125rem] text-[var(--color-danger-text-emphasis)]" role="alert">
          {loadError}
        </p>
      ) : installBot ? (
        <PostPublishInstallPanel
          allowedOrigins={allowedOriginLabels}
          widgetSnippet={widgetSnippet}
          iframeSnippet={iframeSnippet}
          compactCopyButton
        />
      ) : null}
    </Modal>
  );
}
