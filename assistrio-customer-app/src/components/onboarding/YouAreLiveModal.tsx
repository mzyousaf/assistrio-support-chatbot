import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BadgeCheck, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCustomerBot } from '@/api/customerApi';
import type { CustomerBotDetail } from '@/api/types';
import {
  buildOnboardingChatWidgetSnippetFromInstallBot,
  buildOnboardingIframeSnippetFromInstallBot,
} from '@/onboarding/onboardingInstallSnippets';
import { PostPublishInstallPanel } from '@/components/go-live/PostPublishInstallPanel';
import { InlineLoader } from '@/components/PageLoader';
import { Button, Modal } from '@/components/ui';

type Props = {
  open: boolean;
  botId: string | null;
  onClose: () => void;
};

export function YouAreLiveModal({ open, botId, onClose }: Props) {
  const [bot, setBot] = useState<CustomerBotDetail | null>(null);
  const [loadingBot, setLoadingBot] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !botId) {
      setBot(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadingBot(true);
    setLoadError(null);
    void getCustomerBot(botId).then((res) => {
      if (cancelled) return;
      setLoadingBot(false);
      if (!res.ok) {
        setLoadError(res.error);
        setBot(null);
        return;
      }
      setBot(res.data.bot);
    });
    return () => {
      cancelled = true;
    };
  }, [open, botId]);

  const installBot = useMemo(() => {
    if (!bot || !botId) return null;
    return {
      id: botId,
      name: String(bot.name ?? ''),
      accessKey: String(bot.accessKey ?? ''),
      ...(bot.visibility === 'private' && bot.secretKey ? { secretKey: String(bot.secretKey) } : {}),
      visibility: bot.visibility === 'private' ? ('private' as const) : ('public' as const),
      allowedOrigins: Array.isArray(bot.allowedOrigins) ? bot.allowedOrigins : [],
    };
  }, [bot, botId]);

  const allowedOriginLabels = useMemo(() => {
    const rows = installBot?.allowedOrigins ?? [];
    return rows
      .filter((row) => row.isActive !== false)
      .map((row) => String(row.origin ?? '').trim())
      .filter(Boolean);
  }, [installBot]);

  const widgetSnippet = useMemo(() => {
    if (!installBot || !botId) return '';
    return buildOnboardingChatWidgetSnippetFromInstallBot(installBot, botId);
  }, [installBot, botId]);

  const iframeSnippet = useMemo(() => {
    if (!installBot || !botId) return '';
    return buildOnboardingIframeSnippetFromInstallBot(installBot, botId);
  }, [installBot, botId]);

  const modalTitle: ReactNode = (
    <span className="inline-flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
        <BadgeCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      You&apos;re live
    </span>
  );

  const modalDescription = botId ? (
    <div className="flex flex-col gap-2.5">
      <span className="text-slate-600">
        Paste the snippet on your site, or open{' '}
        <span className="font-medium text-slate-800">Deploy & Go Live</span> anytime to update keys and allowed sites.
      </span>
      <Link
        to={`/bots/${botId}/playground/deploy`}
        className="inline-flex w-fit max-w-full items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-[3px] decoration-primary/35 transition-colors hover:text-[var(--teal-800)] hover:decoration-[var(--teal-800)]/50 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        onClick={onClose}
      >
        <BookOpen size={16} strokeWidth={2} className="shrink-0 text-primary" aria-hidden />
        Install guide & embed settings
      </Link>
    </div>
  ) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      size="md"
      className="max-h-[min(92vh,52rem)] max-w-md"
      bodyClassName="py-4 sm:py-5"
      footer={
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loadingBot ? (
        <InlineLoader title="Loading your agent…" className="min-h-[11rem] py-8" />
      ) : null}

      {loadError ? (
        <p className="m-0 text-[0.8125rem] text-[var(--color-danger-text-emphasis)]" role="alert">
          {loadError}
        </p>
      ) : null}

      {installBot && !loadingBot && !loadError ? (
        <PostPublishInstallPanel
          allowedOrigins={allowedOriginLabels}
          widgetSnippet={widgetSnippet}
          iframeSnippet={iframeSnippet}
        />
      ) : null}
    </Modal>
  );
}
