import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { AdminLiveChatAdapter, ClampedTextWithSeeMore, type SuggestedQuestionChip } from '@assistrio/chat-widget';
import type { BotChatUI } from '@acw/models/botChatUI';
import { customerGoogleAuthStartUrl, getCustomerApiOrigin } from '@/api/client';
import { getSharedBotInit } from '@/api/customerApi';
import type { SharedBotInitPayload } from '@/api/types';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { GoogleSignInLink } from '@/components/auth/GoogleSignInButton';
import { PLAN_LIMIT_SHARE_PREVIEW_CODE } from '@/lib/planLimitError';
import { PageLoaderSpinner } from '@/components/PageLoader';
import { cn } from '@/lib/utils';

export function formatSharePreviewUserMessage(raw: string, errorCode?: string): string {
  if (errorCode === PLAN_LIMIT_SHARE_PREVIEW_CODE) {
    return 'This preview link is no longer active. Please contact the workspace owner.';
  }
  const t = raw.trim();
  if (!t || t.startsWith('{')) {
    return 'This preview link is not available. Ask the agent owner to check Share Agent Preview in their workspace.';
  }
  const lower = t.toLowerCase();
  if (lower.includes('expired') || lower.includes('share_preview_expired')) {
    return 'This preview link has expired. Ask the owner to create a new share link.';
  }
  if (lower.includes('revoked')) {
    return 'This preview link was revoked. Ask the owner for a new link.';
  }
  if (lower.includes('disabled') || lower.includes('turned off')) {
    return 'Share preview is turned off for this agent.';
  }
  if (
    lower.includes('share token') ||
    lower.includes('token is required') ||
    lower.includes('share_token') ||
    lower.includes('invalid share token') ||
    lower.includes('secure token') ||
    lower.includes('invalid token')
  ) {
    return 'This URL is missing a valid security token or the token no longer matches. Open Share Agent Preview and copy the full link.';
  }
  if (lower.includes('not found') || lower.includes('share_not_found')) {
    return 'This preview could not be found. The link may be wrong or the agent may no longer be shared.';
  }
  if (lower.includes('regenerate')) {
    return t.length < 220 ? t : 'The owner needs to regenerate the share preview link in their workspace.';
  }
  return t.length > 320 ? `${t.slice(0, 317)}…` : t;
}

const SHARE_PREVIEW_FEATURES = [
  'Knowledge-based answers',
  'Preview experience',
  'Secure shared link',
] as const;

/** Desktop widget panel targets inside the website preview canvas (not full-card embed). */
export const SHARE_PREVIEW_WIDGET_COLLAPSED_W = 404;
export const SHARE_PREVIEW_WIDGET_COLLAPSED_H_MAX = 720;
export const SHARE_PREVIEW_WIDGET_EXPANDED_W_MAX = 620;

function SharePreviewPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'relative flex h-dvh min-h-dvh min-w-0 flex-col overflow-x-hidden',
        'bg-gradient-to-br from-white via-[var(--color-teal-50)]/50 to-slate-100/95',
      )}
      data-share-preview-page-shell
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_60%_at_50%_-15%,color-mix(in_oklab,var(--color-teal-400)_16%,transparent),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_100%,color-mix(in_oklab,var(--color-teal-300)_8%,transparent),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[length:32px_32px]"
        aria-hidden
      />
      {children}
    </div>
  );
}

function SharePoweredByFooter({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'text-[0.8125rem] text-slate-500',
        className,
      )}
    >
      Powered by Assistrio
    </p>
  );
}

function ShareLoadingView() {
  return (
    <SharePreviewPageShell>
      <main className="relative z-[1] flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div
            className="flex max-w-lg flex-col items-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading share preview"
          >
            <PageLoaderSpinner size="page" className="mx-auto" />
            <p className="page-loader-text mt-6 text-sm font-medium sm:text-base">Loading preview…</p>
            <p className="page-loader-text mt-3 max-w-sm text-sm font-medium leading-relaxed sm:text-[0.9375rem]">
              Setting up your Assistrio-hosted chat experience.
            </p>
          </div>
        </div>
        <SharePoweredByFooter className="mt-8 text-center" />
      </main>
    </SharePreviewPageShell>
  );
}

function ShareUnavailableView({ message }: { message: string }) {
  const detail = formatSharePreviewUserMessage(message);
  return (
    <SharePreviewPageShell>
      <main className="relative z-[1] flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white/95 px-8 py-10 text-center shadow-[var(--shadow-lg)] ring-1 ring-slate-900/[0.04] backdrop-blur-sm sm:px-10">
            <img
              src="/logo-180x180.png"
              alt=""
              width={48}
              height={48}
              className="mx-auto h-12 w-12 rounded-2xl object-contain shadow-sm ring-1 ring-slate-900/[0.05]"
              decoding="async"
            />
            <h1 className="mt-6 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Preview link unavailable
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{detail}</p>
          </div>
        </div>
        <SharePoweredByFooter className="mt-8 text-center" />
      </main>
    </SharePreviewPageShell>
  );
}

function SharePreviewLiveHeader({ className }: { className?: string }) {
  return (
    <div className={cn('text-center', className)} data-share-preview-live-header>
      <p
        className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
        data-share-preview-live-label
      >
        Live widget preview
      </p>
      <p className="mt-1.5 m-0 text-sm leading-snug text-slate-600">
        Interact with this agent like it is installed on a website.
      </p>
    </div>
  );
}

function SharePreviewWebsiteFooter({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute inset-x-0 bottom-0 z-[1] px-4 pb-4 pt-3 sm:px-6 sm:pb-5',
        className,
      )}
      data-share-preview-website-footer
    >
      <SharePreviewLiveHeader />
      <SharePoweredByFooter className="mt-3 text-center" />
    </div>
  );
}

function SharePreviewCreateAgentCta() {
  const { status } = useCustomerAuth();
  const googleStartUrl = customerGoogleAuthStartUrl();

  if (status === 'loading' || status === 'authenticated') {
    return null;
  }

  return (
    <div className="mt-6 flex max-w-full flex-col gap-3" data-share-preview-create-agent-cta>
      <p className="m-0 text-sm font-semibold text-slate-800">Create your own Free AI support agent</p>
      <GoogleSignInLink href={googleStartUrl} className="w-fit max-w-full font-semibold" />
    </div>
  );
}

function SharePreviewWebsiteContent({
  agentName,
  description,
}: {
  agentName: string;
  description?: string;
}) {
  const subtitle =
    description?.trim() ||
    'This AI agent is shared through Assistrio. Ask a question and test how it responds.';

  return (
    <div
      className={cn(
        'pointer-events-auto absolute inset-0 z-[1] overflow-x-hidden overflow-y-auto',
        'pb-28 sm:pb-32',
      )}
      data-share-preview-stage-intro
      data-share-preview-website-hero
    >
      <div
        className={cn(
          'flex min-h-full w-full min-w-0 items-center',
          'py-8 sm:py-10',
          'pl-[clamp(1.25rem,8vw,7rem)] pr-3',
          'sm:pr-5 md:pl-[clamp(2rem,12vw,10rem)] md:pr-6',
          'lg:pl-[clamp(2.5rem,14vw,12rem)]',
        )}
      >
        <div className="w-full min-w-0 max-w-lg md:max-w-[min(32rem,52%)] break-words [overflow-wrap:anywhere]">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src="/logo-180x180.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-xl object-contain shadow-sm ring-1 ring-slate-900/[0.05]"
                decoding="async"
              />
              <span className="truncate text-lg font-semibold tracking-tight text-slate-900">Assistrio</span>
            </div>
            <span
              className="rounded-full border border-teal-200/95 bg-teal-50 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-teal-900"
              data-share-preview-badge
            >
              Shared agent preview
            </span>
          </div>

          <h1 className="mt-5 m-0 text-[1.375rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[1.625rem] md:text-[2rem] md:leading-snug">
            Chat with{' '}
            <span className="text-[var(--color-teal-800)]">{agentName}</span>
          </h1>
          <ClampedTextWithSeeMore
            text={subtitle}
            modalTitle={`Chat with ${agentName}`}
            maxLines={10}
            className="mt-3 min-w-0 text-[0.9375rem] leading-relaxed text-slate-600 sm:text-base"
            seeMoreClassName="text-teal-700"
          />

          <ul className="m-0 mt-5 list-none space-y-2 p-0">
            {SHARE_PREVIEW_FEATURES.map((label) => (
              <li key={label} className="flex min-w-0 items-start gap-2.5 text-sm leading-snug text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" strokeWidth={2.25} aria-hidden />
                <span className="min-w-0 break-words">{label}</span>
              </li>
            ))}
          </ul>

          <SharePreviewCreateAgentCta />
        </div>
      </div>
    </div>
  );
}

function SharePreviewWebsiteBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      data-share-preview-website-backdrop
      aria-hidden
    >
      <div className="absolute inset-x-0 top-0 flex items-center gap-4 border-b border-slate-200/40 bg-white/30 px-6 py-3">
        <span className="h-2 w-14 rounded-full bg-slate-200/70" />
        <span className="h-2 w-10 rounded-full bg-slate-200/50" />
        <span className="h-2 w-10 rounded-full bg-slate-200/50" />
        <span className="ml-auto h-2 w-16 rounded-full bg-slate-200/40" />
      </div>
      <div className="absolute bottom-[28%] left-6 right-6 grid grid-cols-2 gap-3 md:left-8 md:right-8">
        <span className="block h-24 rounded-xl border border-slate-200/50 bg-white/50" />
        <span className="block h-24 rounded-xl border border-slate-200/50 bg-white/50" />
      </div>
    </div>
  );
}

function SharePreviewWidgetStage({
  websiteContent,
  websiteFooter,
  children,
}: {
  websiteContent?: React.ReactNode;
  websiteFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden',
        'border border-slate-200/90 bg-white/95',
      )}
      data-share-preview-widget-stage
      data-share-preview-website-canvas
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-slate-50/95 px-4 py-2.5"
        data-share-preview-website-chrome
        aria-hidden
      >
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/90" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md border border-slate-200/80 bg-white px-3 py-1 text-[11px] text-slate-400">
          your-website.com
        </span>
      </div>
      <div
        data-widget-preview-measure
        data-share-preview-measure-host
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden',
          'bg-gradient-to-br from-slate-50/90 via-white to-[var(--color-teal-50)]/40',
        )}
      >
        <SharePreviewWebsiteBackdrop />
        {websiteContent}
        {websiteFooter}
        <div className="pointer-events-none absolute inset-0 z-[2]">{children}</div>
      </div>
    </div>
  );
}

function SharePreviewReadyView({
  init,
  sharePreviewToken,
}: {
  init: SharedBotInitPayload;
  sharePreviewToken: string;
}) {
  const settings = init.settings ?? {};
  const chatUI = (settings.chatUI ?? undefined) as BotChatUI | undefined;
  const chips = (init.bot.suggestedQuestionChips ?? undefined) as SuggestedQuestionChip[] | undefined;
  const brandProps = {
    agentName: init.bot.name,
    description: init.bot.description ?? init.bot.tagline,
  };

  return (
    <SharePreviewPageShell>
      <main
        className={cn(
          'relative z-[1] flex h-full min-h-0 w-full flex-1 flex-col',
          'max-md:overflow-y-auto',
          'min-w-0 overflow-x-hidden',
        )}
        data-testid="share-preview-ready-layout"
        data-share-preview-ready-layout
      >
        <div
          className={cn(
            'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
          )}
          data-share-preview-chat-column
          data-share-preview-live-widget-column
        >
          <SharePreviewWidgetStage
            websiteContent={<SharePreviewWebsiteContent {...brandProps} />}
            websiteFooter={<SharePreviewWebsiteFooter />}
          >
            <AdminLiveChatAdapter
              botId={init.bot.id}
              mode="runtime"
              runtimeSurface="shared"
              sharedSlug={init.shareSlug}
              sharePreviewToken={sharePreviewToken || undefined}
              botName={init.bot.name}
              avatarUrl={init.bot.imageUrl}
              avatarEmoji={init.bot.avatarEmoji}
              chatUI={chatUI}
              tagline={init.bot.tagline}
              description={init.bot.description}
              welcomeMessage={init.bot.welcomeMessage}
              suggestedQuestions={init.bot.suggestedQuestions ?? init.bot.exampleQuestions}
              suggestedQuestionChips={chips}
              apiBaseUrl={getCustomerApiOrigin()}
              chatVisitorId={init.chatVisitorId}
              debug={false}
              footerPrivacyText={typeof settings.privacyText === 'string' ? settings.privacyText : undefined}
              visitorMultiChatEnabled={settings.visitorMultiChatEnabled === true}
              visitorMultiChatMax={
                settings.visitorMultiChatMax === null || settings.visitorMultiChatMax === undefined
                  ? null
                  : Number(settings.visitorMultiChatMax)
              }
              stageMode="live-widget"
              containedStage
              defaultOpen
              inlinePanelCollapsedWidth={SHARE_PREVIEW_WIDGET_COLLAPSED_W}
              inlinePanelCollapsedHeight={SHARE_PREVIEW_WIDGET_COLLAPSED_H_MAX}
              inlinePanelExpandedWidth={SHARE_PREVIEW_WIDGET_EXPANDED_W_MAX}
              className="h-full min-h-0 w-full"
            />
          </SharePreviewWidgetStage>
        </div>
      </main>
    </SharePreviewPageShell>
  );
}

export function SharedChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const sharePreviewToken = (searchParams.get('shareToken') ?? '').trim();
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorText, setErrorText] = useState('');
  const [init, setInit] = useState<SharedBotInitPayload | null>(null);

  useEffect(() => {
    const s = (slug ?? '').trim().toLowerCase();
    if (!s) {
      setErrorText('Invalid link.');
      setPhase('error');
      return;
    }
    const storageKey = `assistrio_share_visitor:${s}`;
    let cancelled = false;
    (async () => {
      const existing =
        typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) ?? undefined : undefined;
      const r = await getSharedBotInit(s, existing, sharePreviewToken || undefined);
      if (cancelled) return;
      if (!r.ok) {
        const body =
          r.body && typeof r.body === 'object' ? (r.body as Record<string, unknown>) : null;
        const errorCode =
          typeof r.errorCode === 'string'
            ? r.errorCode
            : typeof body?.errorCode === 'string'
              ? body.errorCode
              : undefined;
        const message =
          typeof body?.message === 'string' && body.message.trim()
            ? body.message.trim()
            : typeof body?.error === 'string' && body.error.trim()
              ? body.error.trim()
              : r.error;
        setErrorText(formatSharePreviewUserMessage(message, errorCode));
        setPhase('error');
        return;
      }
      try {
        localStorage.setItem(storageKey, r.data.chatVisitorId);
      } catch {
        /* ignore */
      }
      setInit(r.data);
      setPhase('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, sharePreviewToken]);

  if (phase === 'loading') {
    return <ShareLoadingView />;
  }

  if (phase === 'error' || !init) {
    return <ShareUnavailableView message={errorText} />;
  }

  return <SharePreviewReadyView init={init} sharePreviewToken={sharePreviewToken} />;
}
