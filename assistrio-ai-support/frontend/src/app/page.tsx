import Link from "next/link";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
      <div className="relative mx-auto max-w-5xl px-6 py-20">
        <header className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-brand-700 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Support AI console
          </div>
          <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Chat agents on your content
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            A Chatbase-style workspace: connect knowledge, tune your agent, preview the widget, and ship to your site — without the legacy platform extras.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/user/login"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600"
            >
              Sign in
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/health"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand-500/40"
            >
              API health
            </Link>
          </div>
        </header>

        <section className="mt-24 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Knowledge",
              body: "Upload documents and FAQs; the API runs full RAG ingestion.",
              icon: MessageSquare,
            },
            {
              title: "Bots",
              body: "Draft, publish, and manage access keys and embed settings.",
              icon: Sparkles,
            },
            {
              title: "Preview",
              body: "Live widget preview while you edit — same flow as modern chat SaaS.",
              icon: ArrowRight,
            },
          ].map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-200/80 bg-white/90 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="mt-4 font-heading text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
