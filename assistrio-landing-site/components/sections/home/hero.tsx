import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { HeroPrimaryCtas } from "@/components/sections/home/hero-primary-ctas";

export function Hero() {
  return (
    <Section
      id="hero"
      className="relative border-b border-[var(--border-default)] overflow-hidden bg-gradient-to-b from-[var(--brand-teal-subtle)]/45 via-white to-[var(--background)] pt-12 pb-16 sm:pt-16 sm:pb-20"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,28rem)] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.12),transparent_65%)]"
        aria-hidden
      />
      <Container className="relative">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 xl:gap-20">
          <div>
            <Badge>AI support · Knowledge-grounded</Badge>
            <h1 className="mt-6 max-w-[22ch] font-[family-name:var(--font-display)] text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.15rem]">
              Ship support chatbots your customers can trust
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--foreground-muted)]">
              Turn docs and FAQs into grounded answers — then deploy a <strong className="font-medium text-slate-800">runtime widget</strong> on your domain with hostname rules you control. Start with a{" "}
              <strong className="font-medium text-slate-800">free trial</strong> or explore{" "}
              <strong className="font-medium text-slate-800">live showcase demos</strong> on this site.
            </p>
            <HeroPrimaryCtas />
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--foreground-subtle)]">
              <span className="font-medium text-slate-700">Primary:</span> trial — no card.{" "}
              <span className="font-medium text-slate-700">Secondary:</span> gallery — real runtime, shared demo quota.
            </p>
          </div>

          <aside className="relative lg:pl-2">
            <div
              className="absolute -inset-1 -z-10 rounded-[1.35rem] bg-gradient-to-br from-[var(--brand-teal)]/12 via-transparent to-[var(--brand-teal-faint)] opacity-90 blur-px"
              aria-hidden
            />
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white/90 p-6 shadow-[var(--shadow-md)] ring-1 ring-inset ring-white/70 backdrop-blur-sm sm:p-8">
              <p className="text-eyebrow">How teams evaluate</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--foreground-muted)]">
                Configure in Assistrio, embed on your site — preview stays in product UIs; customers only hit{" "}
                <strong className="font-medium text-slate-800">runtime</strong> on your allowlisted origin.
              </p>
              <ul className="mt-6 space-y-4 border-t border-[var(--border-default)] pt-6 text-sm text-[var(--foreground-muted)]">
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal-subtle)] text-xs font-bold text-[var(--brand-teal-dark)]">
                    1
                  </span>
                  <span>
                    <strong className="font-medium text-slate-800">Trial bot</strong> — your hostname, your snippet, production-style init and quota.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    2
                  </span>
                  <span>
                    <strong className="font-medium text-slate-800">Live demos</strong> — curated bots on this origin; separate showcase quota from trial runtime.
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
