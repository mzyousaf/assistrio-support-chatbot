"use client";

import type { PublicBotDetail } from "@/types/bot";
import { AssistrioShowcaseRuntimeEmbed } from "@/components/widget/assistrio-showcase-runtime-embed";
import { RuntimeDeployCallout } from "@/components/visitor/runtime-deploy-callout";

type Props = {
  bot: PublicBotDetail;
};

/**
 * Showcase bot detail: runtime embed when this page origin is an active allowed origin on the agent.
 */
export function ShowcaseBotDetailClient({ bot }: Props) {
  const canEmbed = !!(bot.id && bot.accessKey);

  return (
    <div className="space-y-10 lg:space-y-12">
      <div className="rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-br from-white via-slate-50/30 to-[var(--brand-teal-subtle)]/20 p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <p className="text-eyebrow">Showcase runtime</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 sm:text-2xl">
          Chat with this AI Agent on this page
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          This is a <strong className="font-medium text-slate-800">live runtime demo</strong> — the same embed stack as
          production. Draft and owner preview stay in the Assistrio app.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          The widget only loads when this <strong className="font-medium text-slate-800">page origin</strong> exactly
          matches an <strong className="font-medium text-slate-800">active</strong> entry in this agent&apos;s allowed
          origins (configured in the product).
        </p>
        <div className="mt-5">
          <RuntimeDeployCallout />
        </div>
      </div>

      <div className="min-w-0 space-y-8">
        {canEmbed ? (
          <AssistrioShowcaseRuntimeEmbed botId={bot.id} accessKey={bot.accessKey} />
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-amber-200/90 bg-amber-50/80 px-4 py-5 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
            <p className="font-semibold">Runtime embed unavailable</p>
            <p className="mt-2 leading-relaxed text-amber-950/95">
              Public API did not return the access key needed to mount runtime. Contact the operator if this should be
              available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
