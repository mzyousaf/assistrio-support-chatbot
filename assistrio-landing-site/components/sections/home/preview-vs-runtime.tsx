import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

export function PreviewVsRuntime() {
  return (
    <Section className="relative">
      <Container>
        <HomeSectionHeader eyebrow="Product model" title="Preview vs runtime">
          <p className="max-w-2xl text-base leading-relaxed">
            Preview and runtime are separate pipelines — both exist in the product; this site only embeds{" "}
            <strong className="font-medium text-slate-800">runtime</strong> demos, not owner preview.
          </p>
        </HomeSectionHeader>
        <div className="mt-12 rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-br from-white via-slate-50/40 to-[var(--brand-teal-subtle)]/20 p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <Card className="border-[var(--border-default)] bg-white/95 shadow-none ring-1 ring-inset ring-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assistrio-only</p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">
                Preview
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
                Owners test drafts and configuration inside Assistrio-hosted preview. This path is not a substitute for
                your production embed and does not replace your allowlisted domain for customer traffic.
              </p>
            </Card>
            <Card className="border-[var(--border-teal-soft)] bg-white/95 shadow-[var(--shadow-xs)] ring-1 ring-[var(--brand-teal)]/10">
              <p className="text-xs font-semibold uppercase tracking-[var(--brand-teal-dark)]">Your traffic</p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">
                Runtime
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
                The widget on your site uses your declared hostname allowlist. Trial bots and showcase embeds enforce
                origin rules on the server. Your stable{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code> selects whose quota bucket
                applies — not the hostname alone.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
}
