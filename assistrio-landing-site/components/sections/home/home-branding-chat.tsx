import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const visual = [
  "Brand colors that carry through the widget and accents",
  "Light or dark chat appearance to match your site",
  "Launcher style — default, your AI Support Agent avatar, or a custom image",
  "Widget position on the page so it feels intentional, not random",
  "Panel borders and shadow depth tuned to your brand weight",
];

const chatExperience = [
  "Welcome message that sets expectations the way your team would",
  "Sender identity and optional live status in the header",
  "Timestamps and copy actions so visitors can save what matters",
  "Sources when the AI Support Agent cites your knowledge",
  "Suggested prompts that guide first messages",
  "Menu links to key pages or workflows",
  "Optional file upload and voice input where you enable them",
];

const behavior = [
  "Tone and support style aligned to your brand voice",
  "Response flow that respects what the agent is allowed to say",
  "Escalation paths that feel intentional when the thread needs a person — without breaking the chat rhythm",
];

export function HomeBrandingChat() {
  return (
    <Section
      id="branding-chat"
      spacing="loose"
      className="relative border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--surface-muted)]/25 via-white to-white"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)] to-transparent" aria-hidden />
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader id="branding-chat-heading" eyebrow="Brand & experience" title="Make every AI Support Agent feel like your brand" titleWide align="split">
            <p>
              Control lives here: chrome, copy, and motion in the thread — not pricing, not charts, not infrastructure. If it affects what visitors see and read, it belongs in this
              section.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <div className="mt-14 max-w-4xl space-y-10 lg:mt-16 lg:space-y-14">
          <ScrollReveal y={22}>
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white/95 p-8 shadow-[var(--shadow-sm)] sm:p-10">
              <h4 className="text-card-label-accent">Visual identity</h4>
              <p className="mt-2 text-[0.9375rem] text-[var(--foreground-muted)]">What you control</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:gap-4">
                {visual.map((t) => (
                  <li key={t} className="flex gap-3 text-[0.9375rem] leading-relaxed text-[var(--foreground-muted)]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal y={22} delay={0.05}>
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-teal-soft)] bg-gradient-to-br from-white to-[var(--brand-teal-subtle)]/25 p-8 shadow-[var(--shadow-md)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_12%,transparent)] sm:p-10">
              <h4 className="text-card-label-accent">Chat experience</h4>
              <p className="mt-2 text-[0.9375rem] text-[var(--foreground-muted)]">What visitors experience in the thread</p>
              <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:gap-4">
                {chatExperience.map((t) => (
                  <li key={t} className="flex gap-3 text-[0.9375rem] leading-relaxed text-[var(--foreground-muted)]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal y={22} delay={0.1}>
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-muted)]/35 p-8 sm:p-10">
              <h4 className="text-card-label">Behavior</h4>
              <p className="mt-2 text-[0.9375rem] text-[var(--foreground-muted)]">What you achieve</p>
              <ul className="mt-6 max-w-3xl space-y-3 text-[0.9375rem] leading-relaxed text-[var(--foreground-muted)]">
                {behavior.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </Section>
  );
}
