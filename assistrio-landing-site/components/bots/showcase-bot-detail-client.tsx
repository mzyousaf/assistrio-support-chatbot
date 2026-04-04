"use client";

import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import type { PublicBotDetail } from "@/types/bot";
import { StableIdentityPanel } from "@/components/visitor/stable-identity-panel";
import { QuotaSummaryCard } from "@/components/visitor/quota-summary-card";
import { AssistrioShowcaseRuntimeEmbed } from "@/components/widget/assistrio-showcase-runtime-embed";
import { ShowcaseWebsiteRegistration } from "@/components/bots/showcase-website-registration";
import { RuntimeDeployCallout } from "@/components/visitor/runtime-deploy-callout";

type Props = {
  bot: PublicBotDetail;
};

/**
 * Showcase bot detail: runtime-only flows for landing (identity, shared quota, CDN embed, optional website registration).
 * Preview/session owner flows are not included — those stay in Assistrio product UIs.
 */
export function ShowcaseBotDetailClient({ bot }: Props) {
  const { platformVisitorId, status } = usePlatformVisitorId();
  const identityReady = status === "ready" && !!platformVisitorId;

  const canEmbed = !!(bot.id && bot.accessKey);

  return (
    <div className="space-y-10 lg:space-y-12">
      <div className="rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-br from-white via-slate-50/30 to-[var(--brand-teal-subtle)]/20 p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <p className="text-eyebrow">Showcase runtime</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 sm:text-2xl">
          Try this bot on this page
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          <strong className="font-medium text-slate-800">Runtime demo</strong> only — not owner preview. Messages count
          against the <strong className="font-medium text-slate-800">showcase runtime</strong> quota slice for your stable
          id (shared across every gallery bot). Draft and preview workflows stay in the Assistrio app.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          The embed may only load when your <strong className="font-medium text-slate-800">page origin</strong> is
          allowed for this bot — either an Assistrio-configured demo host or a URL you register below for your current{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code>.
        </p>
        <div className="mt-5">
          <RuntimeDeployCallout context="showcase" />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-10 lg:items-start">
        <div className="space-y-6 lg:col-span-5">
          <StableIdentityPanel variant="compact" />
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Quota</p>
            <QuotaSummaryCard />
          </div>
        </div>

        <div className="space-y-8 lg:col-span-7">
          {canEmbed ? (
            <AssistrioShowcaseRuntimeEmbed
              botId={bot.id}
              accessKey={bot.accessKey}
              platformVisitorId={platformVisitorId}
              identityReady={identityReady}
            />
          ) : (
            <div className="rounded-[var(--radius-xl)] border border-amber-200/90 bg-amber-50/80 px-4 py-5 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
              <p className="font-semibold">Runtime embed unavailable</p>
              <p className="mt-2 leading-relaxed text-amber-950/95">
                Public API did not return the access key needed to mount runtime. You can still review metadata and
                register a website if the API exposes credentials another way — otherwise contact the operator.
              </p>
            </div>
          )}

          {canEmbed ? (
            <div className="border-t border-dashed border-[var(--border-strong)] pt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Your own site</p>
              <ShowcaseWebsiteRegistration botId={bot.id} accessKey={bot.accessKey} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
