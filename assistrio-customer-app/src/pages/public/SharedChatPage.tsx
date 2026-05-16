import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AdminLiveChatAdapter, type SuggestedQuestionChip } from '@assistrio/chat-widget';
import type { BotChatUI } from '@acw/models/botChatUI';
import { getCustomerApiOrigin } from '@/api/client';
import { getSharedBotInit } from '@/api/customerApi';
import type { SharedBotInitPayload } from '@/api/types';
import { PageLoaderSpinner } from '@/components/PageLoader';
import { cn } from '@/lib/utils';

function formatSharePreviewUserMessage(raw: string): string {
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

function SharePageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'relative flex h-dvh min-h-dvh min-w-0 flex-col overflow-x-hidden',
        'bg-gradient-to-br from-white via-[var(--color-teal-50)]/45 to-slate-100/90',
      )}
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
        'border-t border-slate-200/60 pt-4 text-center text-[0.8125rem] text-slate-500 sm:pt-5',
        className,
      )}
    >
      Powered by Assistrio
    </p>
  );
}

function ShareLoadingView() {
  return (
    <SharePageShell>
      <main className="relative z-[1] mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
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
        <SharePoweredByFooter />
      </main>
    </SharePageShell>
  );
}

function ShareUnavailableView({ message }: { message: string }) {
  const detail = formatSharePreviewUserMessage(message);
  return (
    <SharePageShell>
      <main className="relative z-[1] mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
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
        <SharePoweredByFooter />
      </main>
    </SharePageShell>
  );
}

function ShareBrandHeader({ botName }: { botName: string }) {
  return (
    <header className="shrink-0">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-180x180.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-contain shadow-sm ring-1 ring-slate-900/[0.05]"
            decoding="async"
          />
          <span className="text-lg font-semibold tracking-tight text-slate-900">Assistrio</span>
        </div>
        <span className="rounded-full border border-teal-200/95 bg-teal-50 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-teal-900">
          Shared preview
        </span>
      </div>
      <h1 className="mt-4 text-[1.35rem] font-semibold leading-tight tracking-tight text-slate-900 sm:mt-5 sm:text-2xl sm:leading-snug">
        Preview{' '}
        <span className="text-[var(--color-teal-800)]">{botName}</span>
      </h1>
      <p className="mt-2 max-w-[52rem] text-sm leading-relaxed text-slate-600 sm:mt-2.5 sm:text-[0.9375rem]">
        Try this chatbot on an Assistrio-hosted preview page before installing it on a website.
      </p>
    </header>
  );
}

export function SharedChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const sharePreviewToken = (searchParams.get('shareToken') ?? '').trim();
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorText, setErrorText] = useState('');
  const [init, setInit] = useState<SharedBotInitPayload | null>(null);
  const [panelPx, setPanelPx] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    const upd = () => setPanelPx({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

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
        setErrorText(r.error);
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

  const settings = init.settings ?? {};
  const chatUI = (settings.chatUI ?? undefined) as BotChatUI | undefined;
  const chips = (init.bot.suggestedQuestionChips ?? undefined) as SuggestedQuestionChip[] | undefined;

  return (
    <SharePageShell>
      <main className="relative z-[1] mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col overflow-x-hidden px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
        <ShareBrandHeader botName={init.bot.name} />

        <div
          className={cn(
            'mt-4 flex min-h-0 min-w-0 flex-1 flex-col basis-0 sm:mt-5',
            'rounded-2xl bg-transparent',
            'shadow-[var(--shadow-lg)]',
            'max-sm:rounded-xl max-sm:shadow-md',
            'sm:rounded-3xl',
          )}
        >
          <div
            data-widget-preview-measure
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col basis-0 self-stretch"
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
              accessKey=""
              secretKey=""
              chatVisitorId={init.chatVisitorId}
              debug={false}
              footerPrivacyText={typeof settings.privacyText === 'string' ? settings.privacyText : undefined}
              useFloatingLauncher={false}
              showContainedLauncherPreview={false}
              visitorMultiChatEnabled={settings.visitorMultiChatEnabled === true}
              visitorMultiChatMax={
                settings.visitorMultiChatMax === null || settings.visitorMultiChatMax === undefined
                  ? null
                  : Number(settings.visitorMultiChatMax)
              }
              className="min-h-0 min-w-0 flex-1"
              inlinePanelCollapsedWidth={panelPx.w}
              inlinePanelCollapsedHeight={panelPx.h}
              inlinePanelExpandedWidth={panelPx.w}
              inlinePanelExpandedHeight={panelPx.h}
            />
          </div>
        </div>

        <SharePoweredByFooter className="mt-4 shrink-0 sm:mt-5" />
      </main>
    </SharePageShell>
  );
}
