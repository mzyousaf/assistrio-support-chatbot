/**
 * Iframe-hosted full panel (`/iframe/:botId`). Embed session cookie is set on the API origin.
 * TODO: For production hardening, serve this route with CSP `frame-ancestors` aligned to bot `allowedOrigins`
 * (e.g. via edge config) in addition to server-side `parentOrigin` checks.
 * TODO: Replace long-lived `secretKey` in the iframe URL with a short-lived token minted by the parent app.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AdminLiveChatAdapter, type SuggestedQuestionChip } from '@assistrio/chat-widget';
import type { BotChatUI } from '@acw/models/botChatUI';
import { getCustomerApiOrigin } from '@/api/client';
import { postWidgetIframeInit } from '@/api/customerApi';
import type { WidgetIframeInitPayload } from '@/api/types';
import { WorkspaceLoadFailureCard } from '@/components/WorkspaceLoadFailureCard';
import { resolveIframeChatFailurePresentation } from '@/lib/workspaceLoadFailurePresentation';

function normalizeParentOriginInput(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  try {
    return new URL(t.includes('://') ? t : `https://${t}`).origin;
  } catch {
    return '';
  }
}

function resolveParentOrigin(searchParams: URLSearchParams): string {
  try {
    const ref = typeof document !== 'undefined' ? document.referrer.trim() : '';
    if (ref) return new URL(ref).origin;
  } catch {
    /* fall through */
  }
  return normalizeParentOriginInput(searchParams.get('parentOrigin') ?? '');
}

export function IframeChatPage() {
  const { botId: botIdParam } = useParams<{ botId: string }>();
  const [searchParams] = useSearchParams();
  const [panelPx, setPanelPx] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    const upd = () => setPanelPx({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);
  const accessKey = (searchParams.get('accessKey') ?? '').trim();
  const secretKey = (searchParams.get('secretKey') ?? '').trim();

  const parentOrigin = useMemo(() => resolveParentOrigin(searchParams), [searchParams]);
  const parentPageUrl = useMemo(() => {
    const raw = (searchParams.get('parentPageUrl') ?? '').trim();
    return raw ? raw.slice(0, 2048) : '';
  }, [searchParams]);

  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorText, setErrorText] = useState('');
  const [init, setInit] = useState<WidgetIframeInitPayload | null>(null);

  const botId = (botIdParam ?? '').trim();

  useEffect(() => {
    if (!botId || !accessKey) {
      setErrorText('Missing bot or access key in the iframe URL.');
      setPhase('error');
      return;
    }
    if (!parentOrigin) {
      setErrorText(
        'Could not verify the parent website. Open this chat from your site (iframe), or add a parentOrigin query parameter for testing.',
      );
      setPhase('error');
      return;
    }

    const storageKey = `assistrio_iframe_visitor:${botId}`;
    const existing =
      typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) ?? undefined : undefined;

    let cancelled = false;
    (async () => {
      const r = await postWidgetIframeInit({
        botId,
        accessKey,
        ...(secretKey ? { secretKey } : {}),
        parentOrigin,
        pageUrl: typeof window !== 'undefined' ? window.location.href.slice(0, 2048) : undefined,
        referrer: typeof document !== 'undefined' ? (document.referrer || '').slice(0, 2048) : undefined,
        ...(existing ? { chatVisitorId: existing } : {}),
      });
      if (cancelled) return;
      if (!r.ok) {
        const blocked = /not allowed|forbidden|origin|referer|invalid/i.test(r.error);
        setErrorText(
          blocked
            ? 'This chatbot is not allowed on this site. Add your site’s origin under Allowed origins in Deploy & Go Live, then try again.'
            : r.error,
        );
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
  }, [botId, accessKey, secretKey, parentOrigin]);

  if (phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading chat…
      </div>
    );
  }

  if (phase === 'error' || !init) {
    const isOriginBlocked = /not allowed|forbidden|origin|referer|invalid/i.test(errorText);
    const pres = resolveIframeChatFailurePresentation(errorText, isOriginBlocked);
    const err = errorText.trim();
    const showDetail =
      Boolean(err) && pres.icon !== 'network' && err !== pres.description.trim();

    return (
      <div className="flex h-dvh min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-slate-50 px-4">
        <WorkspaceLoadFailureCard
          icon={pres.icon}
          title={pres.title}
          description={pres.description}
          detail={showDetail ? errorText : null}
          onPrimary={() => {
            window.location.reload();
          }}
          secondary={null}
        />
      </div>
    );
  }

  const settings = init.settings ?? {};
  const chatUI = (settings.chatUI ?? undefined) as BotChatUI | undefined;
  const chips = (init.bot.suggestedQuestionChips ?? undefined) as SuggestedQuestionChip[] | undefined;

  return (
    <div
      className="flex h-dvh min-h-dvh w-full min-w-0 flex-col overflow-hidden bg-slate-100"
      data-widget-preview-measure
    >
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <AdminLiveChatAdapter
          botId={init.bot.id}
          mode="runtime"
          runtimeSurface="iframe"
          iframeParentOrigin={parentOrigin}
          iframeParentPageUrl={parentPageUrl || undefined}
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
          accessKey={accessKey}
          secretKey={secretKey || undefined}
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
  );
}
