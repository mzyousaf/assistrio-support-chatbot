"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { AssistrioChatEmbed } from "@/components/AssistrioChatEmbed";
import { usePageView } from "@/hooks/usePageView";
import { useVisitorId } from "@/hooks/useVisitorId";

export type PublicBot = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  createdAt: string;
};

type BotsPageClientProps = {
  bots: PublicBot[];
};

export function BotsPageClient({ bots }: BotsPageClientProps) {
  const { visitorId, loading } = useVisitorId();
  usePageView("/bots");
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const createBotUrl =
    visitorId && API_BASE_URL
      ? `${API_BASE_URL}/trial/new?visitorId=${visitorId}`
      : null;

  const activeBot = bots.find((b) => b.id === activeBotId);

  function selectBot(id: string) {
    setConfigError(null);
    if (!API_BASE_URL) {
      setConfigError(
        "Configure NEXT_PUBLIC_API_BASE_URL so the chat widget can reach your API.",
      );
      return;
    }
    setActiveBotId(id);
  }

  function clearSelection() {
    setActiveBotId(null);
    setConfigError(null);
  }

  return (
    <main className="min-h-screen w-full px-4 py-12 sm:px-6 lg:px-8">
      {API_BASE_URL && activeBotId ? (
        <AssistrioChatEmbed botId={activeBotId} apiBaseUrl={API_BASE_URL} />
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

        {configError ? (
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            {configError}
          </p>
        ) : null}

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
            {createBotUrl ? (
              <a
                href={createBotUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
              >
                Open builder
              </a>
            ) : (
              <span className="inline-flex w-fit rounded-full border border-neutral-200 px-5 py-2.5 text-sm text-neutral-500">
                {loading ? "Preparing session…" : "Session required"}
              </span>
            )}
          </article>

          {bots.map((bot) => {
            const selected = activeBotId === bot.id;
            return (
              <button
                key={bot.id}
                type="button"
                onClick={() => selectBot(bot.id)}
                className={`flex h-full min-h-[220px] flex-col gap-3 rounded-2xl border p-6 text-left shadow-sm transition ${
                  selected
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

        {bots.length === 0 ? (
          <p className="text-center text-sm text-neutral-600">
            No public bots yet. Publish bots in the admin panel with{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-800">
              isPublic
            </code>{" "}
            enabled, or check that{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-800">
              NEXT_PUBLIC_API_BASE_URL
            </code>{" "}
            points at your API.
          </p>
        ) : null}
      </div>
    </main>
  );
}
