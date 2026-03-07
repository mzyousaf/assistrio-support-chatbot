"use client";

import { API_BASE_URL } from "@/lib/config";
import { usePageView } from "@/hooks/usePageView";
import { useVisitorId } from "@/hooks/useVisitorId";

type PublicBot = {
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

  if (loading || !visitorId) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-6">
        <p className="text-lg text-slate-300">Initializing session...</p>
      </main>
    );
  }

  const createBotUrl = `${API_BASE_URL}/trial/new?visitorId=${visitorId}`;

  return (
    <main className="min-h-screen w-full px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Explore AI Bots
          </h1>
          <p className="max-w-2xl text-slate-300">
            Try showcase bots trained for different use cases, then launch your
            own assistant in minutes.
          </p>
          <div>
            <a
              href={createBotUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex bg-emerald-500 text-slate-950 rounded-md px-3 py-2 text-sm font-medium"
            >
              Create your own bot
            </a>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => {
            const demoUrl = `${API_BASE_URL}/demo/${bot.slug}?visitorId=${visitorId}`;

            return (
              <article
                key={bot.id}
                className="flex h-full flex-col gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {bot.avatarEmoji || "🤖"}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-50">
                      {bot.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {bot.category || "General"}
                    </p>
                  </div>
                </div>

                <p className="flex-1 text-sm text-slate-300">
                  {bot.shortDescription || "No description available yet."}
                </p>

                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit bg-emerald-500 text-slate-950 rounded-md px-3 py-2 text-sm font-medium"
                >
                  Try this bot
                </a>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
