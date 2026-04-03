"use client";

import Link from "next/link";
import { AssistrioChatEmbed } from "@/components/AssistrioChatEmbed";
import { LandingBotAvatar } from "@/components/bots/landing-bot-avatar";
import { BotsMarkdown } from "@/components/bots/BotsMarkdown";
import { API_BASE_URL } from "@/lib/config";
import { siteRoutes } from "@/content/site";
import type { PublicBotDetail } from "@/types/public-bot";

type Props = {
  bot: PublicBotDetail;
};

export function BotDetailPageClient({ bot }: Props) {
  return (
    <>
      {API_BASE_URL ? (
        <AssistrioChatEmbed
          botId={bot.id}
          apiBaseUrl={API_BASE_URL}
          accessKey={bot.accessKey}
        />
      ) : null}

      <article className="mx-auto w-full max-w-3xl">
        <nav className="mb-8 text-sm text-neutral-500">
          <Link href={siteRoutes.bots} className="font-medium text-brand hover:underline">
            ← All demos
          </Link>
        </nav>

        <header className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-gradient-to-br from-brand-muted/90 via-white to-white p-8 shadow-sm sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <LandingBotAvatar
              name={bot.name}
              imageUrl={bot.imageUrl}
              avatarEmoji={bot.avatarEmoji || "🤖"}
              size="detail"
            />
            <div className="min-w-0 flex-1">
              {bot.category ? (
                <span className="inline-flex rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
                  {bot.category}
                </span>
              ) : null}
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                {bot.name}
              </h1>
              <p className="mt-2 text-lg text-neutral-600">{bot.shortDescription}</p>
              <p className="mt-4 text-sm text-neutral-500">
                Open the chat widget (bottom-right) to try this assistant on this page.
              </p>
            </div>
          </div>
        </header>

        {bot.welcomeMessage ? (
          <blockquote className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50/80 px-6 py-4 text-neutral-800">
            <p className="text-sm font-medium text-neutral-500">Welcome message</p>
            <p className="mt-2 text-base leading-relaxed">{bot.welcomeMessage}</p>
          </blockquote>
        ) : null}

        {bot.description?.trim() ? (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-neutral-900">About this demo</h2>
            <BotsMarkdown content={bot.description} className="mt-4" />
          </section>
        ) : null}

        {bot.exampleQuestions.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-neutral-900">Example questions</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {bot.exampleQuestions.map((q) => (
                <li
                  key={q}
                  className="rounded-xl border border-neutral-200/90 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm"
                >
                  {q}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bot.faqs.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-neutral-900">FAQs</h2>
            <dl className="mt-4 space-y-4">
              {bot.faqs.map((f, i) => (
                <div
                  key={`${f.question}-${i}`}
                  className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm"
                >
                  <dt className="font-semibold text-neutral-900">{f.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-neutral-600">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <div className="mt-14 flex flex-wrap gap-3 border-t border-neutral-200 pt-10">
          <Link
            href={siteRoutes.bots}
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
          >
            Browse all demos
          </Link>
          <Link
            href={siteRoutes.createAgent}
            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
          >
            Create your agent
          </Link>
        </div>
      </article>
    </>
  );
}
