"use client";

import Link from "next/link";
import { PLATFORM_BASE_URL } from "@/lib/config";
import { usePageView } from "@/hooks/usePageView";
import { useVisitorId } from "@/hooks/useVisitorId";

export function LandingHero() {
  usePageView("/");
  const { visitorId, loading } = useVisitorId();

  const createBotUrl = visitorId
    ? `${PLATFORM_BASE_URL}/trial/new?visitorId=${visitorId}`
    : "#";

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_45%)]" />
      </div>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Assistrio AI – Custom Data Chatbots
        </h1>
        <p className="max-w-2xl text-lg text-slate-300 sm:text-xl">
          Test showcase bots or spin up your own AI assistant trained on your
          data.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/bots"
            className="inline-flex rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
          >
            Explore Bots
          </Link>
          <a
            href={createBotUrl}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!visitorId}
            className="inline-flex rounded-md border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            Create Your Bot
          </a>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Initializing session...</p>
        ) : null}
      </section>
    </main>
  );
}
