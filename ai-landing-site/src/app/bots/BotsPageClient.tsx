"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { AssistrioChatEmbed } from "@/components/AssistrioChatEmbed";
import { siteRoutes } from "@/content/site";
import { LandingBotAvatar } from "@/components/bots/landing-bot-avatar";
import { normalizePublicBotsPayload } from "@/lib/normalize-public-bots";
import type { PublicBot } from "@/types/landing-bots";
import { usePageView } from "@/hooks/usePageView";
import { useVisitorId } from "@/hooks/useVisitorId";

export type { PublicBot };

type TrialRuntimeContext = {
  botId: string;
  platformVisitorId: string;
  accessKey: string;
  secretKey?: string;
  visibility?: "public" | "private";
  creatorType?: "user" | "visitor";
};

const TRIAL_CONTEXT_STORAGE_KEY = "assistrio_trial_widget_context_v1";

function readStoredTrialContext(): TrialRuntimeContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TRIAL_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TrialRuntimeContext>;
    if (!parsed || typeof parsed !== "object") return null;
    const platformVisitorId =
      typeof (parsed as { platformVisitorId?: unknown }).platformVisitorId === "string"
        ? (parsed as { platformVisitorId: string }).platformVisitorId
        : undefined;

    if (typeof parsed.botId !== "string" || !platformVisitorId || typeof parsed.accessKey !== "string") {
      return null;
    }
    return {
      botId: parsed.botId,
      platformVisitorId,
      accessKey: parsed.accessKey,
      ...(typeof parsed.secretKey === "string" ? { secretKey: parsed.secretKey } : {}),
      ...(parsed.visibility === "private" || parsed.visibility === "public"
        ? { visibility: parsed.visibility }
        : {}),
      ...(parsed.creatorType === "visitor" || parsed.creatorType === "user"
        ? { creatorType: parsed.creatorType }
        : {}),
    };
  } catch {
    return null;
  }
}

function storeTrialContext(ctx: TrialRuntimeContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRIAL_CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
}

export function BotsPageClient() {
  const { platformVisitorId, loading } = useVisitorId();
  usePageView("/bots");
  const [bots, setBots] = useState<PublicBot[]>([]);
  const [botsLoad, setBotsLoad] = useState<"loading" | "ok" | "error">("loading");
  const [botsError, setBotsError] = useState<string | null>(null);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [trialContext, setTrialContext] = useState<TrialRuntimeContext | null>(null);
  const [creatingTrial, setCreatingTrial] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredTrialContext();
    if (!stored) return;
    if (platformVisitorId && stored.platformVisitorId !== platformVisitorId) return;
    setTrialContext(stored);
    setActiveBotId(stored.botId);
  }, [platformVisitorId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBotsLoad("loading");
      setBotsError(null);
      try {
        const res = await fetch("/api/landing/bots", { cache: "no-store" });
        const data: unknown = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          const errObj = data && typeof data === "object" ? (data as { error?: string }) : {};
          setBotsError(errObj.error ?? `Request failed (${res.status})`);
          setBots([]);
          setBotsLoad("error");
          return;
        }
        const list = Array.isArray(data)
          ? normalizePublicBotsPayload(data)
          : normalizePublicBotsPayload(
              (data as { bots?: unknown }).bots ?? [],
            );
        setBots(list);
        setBotsLoad("ok");
      } catch (e) {
        if (!cancelled) {
          setBotsError(e instanceof Error ? e.message : "Failed to load demos");
          setBots([]);
          setBotsLoad("error");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTrialContext =
    activeBotId && trialContext?.botId === activeBotId ? trialContext : null;

  async function createTrialBot() {
    if (!API_BASE_URL || !platformVisitorId) return;
    setCreatingTrial(true);
    setTrialError(null);
    setCopyMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trial/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformVisitorId,
          name: "Trial Assistant",
          allowedDomain:
            typeof window !== "undefined" && window.location?.hostname
              ? window.location.hostname
              : "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        platformVisitorId?: string;
        bot?: {
          id?: string;
          accessKey?: string;
          visibility?: "public" | "private";
          creatorType?: "user" | "visitor";
        };
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to create trial bot.");
      }
      const botId = typeof data.bot?.id === "string" ? data.bot.id : "";
      const accessKey = typeof data.bot?.accessKey === "string" ? data.bot.accessKey : "";
      const resolvedPlatformVisitorId =
        typeof data.platformVisitorId === "string" && data.platformVisitorId.trim()
          ? data.platformVisitorId
          : platformVisitorId;
      if (!botId || !accessKey || !resolvedPlatformVisitorId) {
        throw new Error("Trial bot response is missing required runtime data.");
      }
      const nextContext: TrialRuntimeContext = {
        botId,
        platformVisitorId: resolvedPlatformVisitorId,
        accessKey,
        visibility: data.bot?.visibility === "private" ? "private" : "public",
        creatorType: data.bot?.creatorType === "visitor" ? "visitor" : "user",
      };
      setTrialContext(nextContext);
      storeTrialContext(nextContext);
      setActiveBotId(botId);
    } catch (error) {
      setTrialError(error instanceof Error ? error.message : "Failed to create trial bot.");
    } finally {
      setCreatingTrial(false);
    }
  }

  const trialSnippet = useMemo(() => {
    if (!trialContext || !API_BASE_URL) return "";
    const configLines = [
      `botId: "${trialContext.botId}"`,
      `apiBaseUrl: "${API_BASE_URL}"`,
      `accessKey: "${trialContext.accessKey}"`,
      ...(trialContext.visibility === "private" && trialContext.secretKey
        ? [`secretKey: "${trialContext.secretKey}"`]
        : []),
      ...(trialContext.creatorType === "visitor" && trialContext.platformVisitorId
        ? [`platformVisitorId: "${trialContext.platformVisitorId}"`]
        : []),
      `position: "right"`,
    ];
    return [
      `<link rel="stylesheet" href="https://widget.assistrio.com/assistrio-chat.css" />`,
      `<script>`,
      `  window.AssistrioChatConfig = {`,
      `    ${configLines.join(",\n    ")}`,
      `  };`,
      `</script>`,
      `<script src="https://widget.assistrio.com/assistrio-chat.js" async></script>`,
    ].join("\n");
  }, [trialContext]);

  const trialActive = Boolean(activeBotId && trialContext?.botId === activeBotId);

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(20,184,166,0.1),transparent)] px-4 py-12 sm:px-6 lg:px-8">
      {API_BASE_URL && trialActive && activeBotId ? (
        <AssistrioChatEmbed
          botId={activeBotId}
          apiBaseUrl={API_BASE_URL}
          accessKey={activeTrialContext?.accessKey}
          secretKey={activeTrialContext?.secretKey}
          platformVisitorId={activeTrialContext?.platformVisitorId}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Demos</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Build yours, then explore showcase agents
          </h1>
          <p className="mt-4 text-lg text-neutral-600">
            Start with a quick trial bot on this site, or open any showcase demo for full detail and a
            live widget on its own page.
          </p>
        </header>

        {trialActive && trialContext ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-muted/50 px-5 py-4 text-sm text-neutral-800 shadow-sm">
            <span>
              Trial widget active — use the launcher in the corner.{" "}
              <span className="text-neutral-500">(Your trial bot)</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveBotId(null);
                setTrialContext(null);
                try {
                  window.localStorage.removeItem(TRIAL_CONTEXT_STORAGE_KEY);
                } catch {
                  /* ignore */
                }
              }}
              className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              Dismiss trial widget
            </button>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Create your agent — full width on mobile, spans 4 cols on large */}
          <article className="group relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-brand via-brand-hover to-teal-700 p-8 text-white shadow-lg shadow-brand/20 lg:col-span-4">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Start here</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">Create your agent</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/90">
                Train on your content, customize the widget, and embed on your site. Or spin up a{" "}
                <strong className="font-semibold">trial bot</strong> instantly on this domain.
              </p>
            </div>
            <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={siteRoutes.createAgent}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand shadow-md transition hover:bg-brand-muted"
              >
                Create your agent
              </Link>
              {platformVisitorId && API_BASE_URL ? (
                <button
                  type="button"
                  onClick={() => void createTrialBot()}
                  disabled={creatingTrial}
                  className="inline-flex items-center justify-center rounded-full border-2 border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
                >
                  {creatingTrial ? "Creating…" : "Quick trial on this page"}
                </button>
              ) : (
                <span className="text-sm text-white/70">
                  {loading ? "Preparing session…" : "Session required for trial"}
                </span>
              )}
            </div>
            {trialError ? <p className="relative mt-3 text-xs text-amber-100">{trialError}</p> : null}
          </article>

          {/* Showcase grid */}
          <div className="lg:col-span-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Showcase demos
            </h2>
            {botsLoad === "loading" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-[200px] animate-pulse rounded-2xl border border-neutral-200/80 bg-neutral-100/80"
                  />
                ))}
              </div>
            ) : botsLoad === "error" ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm text-amber-900">
                {botsError ?? "Could not load demos."} Check{" "}
                <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_API_BASE_URL</code>{" "}
                and optional{" "}
                <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">LANDING_SITE_BOTS_API_KEY</code>{" "}
                (server env). Open DevTools → Network →{" "}
                <code className="font-mono text-xs">/api/landing/bots</code>.
              </p>
            ) : bots.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-neutral-200 bg-white/60 px-6 py-12 text-center text-neutral-500">
                No public demos are configured yet. Seed showcase bots as superadmin or set API URL.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {bots.map((bot) => (
                  <li key={bot.id}>
                    <Link
                      href={`/bots/${encodeURIComponent(bot.slug)}`}
                      className="group flex h-full min-h-[200px] flex-col rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm transition hover:border-brand/35 hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <LandingBotAvatar
                          name={bot.name}
                          imageUrl={bot.imageUrl}
                          avatarEmoji={bot.avatarEmoji ?? "🤖"}
                          size="card"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand/90">
                            {bot.category || "Assistant"}
                          </span>
                          <h3 className="mt-1 text-lg font-semibold leading-snug text-neutral-900 group-hover:text-brand">
                            {bot.name}
                          </h3>
                        </div>
                      </div>
                      <p className="mt-4 flex-1 text-sm leading-relaxed text-neutral-600 line-clamp-3">
                        {bot.shortDescription || "Open for full detail and a live demo."}
                      </p>
                      <span className="mt-4 inline-flex items-center text-sm font-semibold text-brand">
                        View detail &amp; try
                        <span
                          className="ml-1 transition group-hover:translate-x-0.5"
                          aria-hidden
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {trialContext ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900">Trial embed snippet</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Uses your trial bot runtime credentials and visitor identity.
            </p>
            <textarea
              readOnly
              value={trialSnippet}
              rows={9}
              className="mt-3 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs text-neutral-800"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(trialSnippet);
                    setCopyMessage("Snippet copied.");
                  } catch {
                    setCopyMessage("Failed to copy snippet.");
                  }
                }}
                className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Copy snippet
              </button>
              {copyMessage ? (
                <span className="text-xs text-neutral-600">{copyMessage}</span>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
