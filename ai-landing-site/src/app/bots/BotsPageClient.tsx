"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { AssistrioChatEmbed } from "@/components/AssistrioChatEmbed";
import { usePageView } from "@/hooks/usePageView";
import { useVisitorId } from "@/hooks/useVisitorId";

export type PublicBot = {
  id: string;
  name: string;
  slug: string;
  accessKey: string;
  visibility: "public";
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  createdAt: string;
};

type BotsPageClientProps = {
  bots: PublicBot[];
};

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

export function BotsPageClient({ bots }: BotsPageClientProps) {
  const { platformVisitorId, loading } = useVisitorId();
  usePageView("/bots");
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

  const activeBot = bots.find((b) => b.id === activeBotId);
  const activeTrialContext =
    activeBotId && trialContext?.botId === activeBotId ? trialContext : null;

  function selectBot(id: string) {
    if (!API_BASE_URL) return;
    setActiveBotId(id);
  }

  function clearSelection() {
    setActiveBotId(null);
  }

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

  return (
    <main className="min-h-screen w-full px-4 py-12 sm:px-6 lg:px-8">
      {API_BASE_URL && activeBotId ? (
        <AssistrioChatEmbed
          botId={activeBotId}
          apiBaseUrl={API_BASE_URL}
          accessKey={activeTrialContext?.accessKey ?? activeBot?.accessKey}
          secretKey={activeTrialContext?.secretKey}
          platformVisitorId={activeTrialContext?.platformVisitorId}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Demo bots
          </h1>
          <p className="max-w-2xl text-neutral-600">
            Start with your own agent, or pick a public assistant below. A chat widget
            opens on this page—look for the launcher at the bottom corner.
          </p>
        </header>

        {activeBot && API_BASE_URL ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand-muted/60 px-4 py-3 text-sm text-neutral-800">
            <span>
              Preview: <strong className="font-semibold">{activeBot.name}</strong>
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              Close preview
            </button>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="flex h-full min-h-[220px] flex-col justify-between gap-4 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand-muted/80 to-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                Get started
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-900">
                Create your agent
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Train on your files and FAQs, customize the widget, then embed it on
                your site.
              </p>
            </div>
            {platformVisitorId && API_BASE_URL ? (
              <button
                type="button"
                onClick={() => void createTrialBot()}
                disabled={creatingTrial}
                className="inline-flex w-fit items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
              >
                {creatingTrial ? "Creating…" : "Create trial bot"}
              </button>
            ) : (
              <span className="inline-flex w-fit rounded-full border border-neutral-200 px-5 py-2.5 text-sm text-neutral-500">
                {loading ? "Preparing session…" : "Session required"}
              </span>
            )}
            {trialError ? (
              <p className="text-xs text-red-600">{trialError}</p>
            ) : null}
          </article>

          {bots.map((bot) => {
            const selected = activeBotId === bot.id;
            return (
              <button
                key={bot.id}
                type="button"
                onClick={() => selectBot(bot.id)}
                className={`flex h-full min-h-[220px] flex-col gap-3 rounded-2xl border p-6 text-left shadow-sm transition ${selected
                    ? "border-brand bg-brand-muted/40 ring-2 ring-brand/25"
                    : "border-neutral-200/90 bg-white hover:border-brand/20 hover:shadow-md"
                  }`}
              >
                <div className="flex items-start gap-3">
                  {bot.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bot.imageUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-2xl"
                      aria-hidden
                    >
                      {bot.avatarEmoji || "🤖"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-snug text-neutral-900">
                      {bot.name}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {bot.category || "Assistant"}
                    </p>
                  </div>
                </div>

                <p className="flex-1 text-sm leading-relaxed text-neutral-600">
                  {bot.shortDescription || "No description yet."}
                </p>

                <span className="text-xs font-semibold text-brand">
                  {selected ? "Widget active — tap launcher" : "Click to open widget"}
                </span>
              </button>
            );
          })}
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
