"use client";

import { ScrollReveal } from "@/components/motion/scroll-reveal";

const bullets = [
  "Up to 5 AI Agents included on Launch",
  "$25/month per additional AI Agent",
  "1,000 monthly AI credits — add your own OpenAI key and credits do not burn",
  "Each AI Agent: one allowed website, including sub-sites on that website",
  "Full knowledge base, leads, and insights included at published Launch scope",
];

export function PricingHostedCapacity() {
  return (
    <ScrollReveal y={20}>
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-teal-soft)] bg-gradient-to-br from-white via-[var(--brand-teal-subtle)]/20 to-white p-8 shadow-[var(--shadow-md)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_14%,transparent)] sm:p-10">
        <div
          className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(13,148,136,0.12),transparent_68%)]"
          aria-hidden
        />
        <p className="text-eyebrow">Launch capacity</p>
        <h2 className="text-section-title mt-4 max-w-2xl text-balance">AI Agents, credits, and allowed websites on Launch</h2>
        <p className="mt-4 max-w-2xl text-body-relaxed">
          Every Launch subscription follows the same transparent rules for AI Agents, AI credits, and where the widget may run — so
          you can plan brands, regions, or product lines without guessing what is included.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-4">
          {bullets.map((line) => (
            <li
              key={line}
              className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white/95 px-4 py-3.5 text-[0.9375rem] leading-snug text-[var(--foreground-muted)] shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--border-teal-soft)] hover:shadow-[var(--shadow-sm)]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </ScrollReveal>
  );
}
