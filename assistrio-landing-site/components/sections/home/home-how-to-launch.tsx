"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const ease = [0.22, 1, 0.36, 1] as const;

const linkClass =
  "inline-flex h-auto min-h-0 w-auto border-0 bg-transparent px-0 py-0 text-sm font-semibold text-[var(--brand-teal-dark)] shadow-none ring-0 hover:bg-transparent hover:text-[var(--brand-teal-hover)] hover:underline";

const steps = [
  {
    title: "Browse live examples first",
    body: "Open the gallery and chat with showcase bots on this site — same runtime stack visitors get — so you can judge answers, tone, and the widget before you configure anything of your own.",
    flow: "showcase" as const,
    href: "/gallery",
    linkLabel: "See Live Examples",
  },
  {
    title: "Create your own evaluation bot",
    body: "Try it free to spin up a workspace and provision a bot with production-style embeds on the allowed websites you choose. No card — a real evaluation path, not a toy demo.",
    flow: "trial" as const,
    href: "/trial",
    linkLabel: "Try it free",
  },
  {
    title: "Add your knowledge and branding",
    body: "Upload what your business already stands behind, then tune how the agent presents itself — the detailed breakdown lives in the sections below; here you only need the sequence.",
  },
  {
    title: "Activate it on your website",
    body: "Embed the runtime snippet on the allowed websites you configured so the same agent visitors meet during Explore is the one you eventually treat as production.",
  },
  {
    title: "Invite teammates and go live",
    body: "Add the people who own docs, sales, and support so configuration does not live in one inbox — when you are ready for Assistrio to run operations, the commercial path is under Launch on the homepage.",
  },
] as const;

export function HomeHowToLaunch() {
  return (
    <Section
      id="how-to-launch"
      spacing="loose"
      className="relative border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--background)] via-white to-[var(--surface-muted)]/30"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)] to-transparent" aria-hidden />
      <Container>
        <HomeSectionHeader id="how-to-launch-heading" eyebrow="Launch path" title="How to launch with Assistrio" titleWide align="split">
          <p>
            Five beats, one journey: from seeing a live agent to shipping it beside your team — no feature list here, only order of operations.
          </p>
        </HomeSectionHeader>

        <div className="relative mx-auto mt-16 max-w-3xl lg:mt-20 lg:max-w-4xl">
          <div
            className="pointer-events-none absolute left-[1.1875rem] top-8 hidden w-px bg-gradient-to-b from-[var(--brand-teal)]/50 via-[var(--border-default)] to-transparent md:block lg:left-6"
            style={{ bottom: "2rem" }}
            aria-hidden
          />
          <ol className="relative space-y-0">
            {steps.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-8% 0px" }}
                transition={{ duration: 0.5, ease, delay: i * 0.06 }}
                className="relative pb-14 pl-0 last:pb-0 md:grid md:grid-cols-[3.5rem_1fr] md:gap-8 md:pb-16 lg:grid-cols-[4rem_1fr] lg:gap-10"
              >
                <div className="flex items-start gap-4 md:block md:text-right">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-teal)] bg-white text-sm font-bold text-[var(--brand-teal-dark)] shadow-[var(--shadow-sm)] md:ml-auto md:h-12 md:w-12 md:text-base"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="pt-1 font-[family-name:var(--font-display)] text-2xl leading-none text-[color-mix(in_srgb,var(--brand-teal-dark)_25%,var(--foreground-subtle)_75%)] md:hidden">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="min-w-0 border-t border-[var(--border-default)] pt-6 md:border-t-0 md:pt-0 md:pl-2">
                  <h4 className="text-home-h4 text-pretty sm:text-[1.0625rem]">{s.title}</h4>
                  <p className="mt-3 text-[0.9375rem] leading-[1.75] text-[var(--foreground-muted)]">{s.body}</p>
                  {"flow" in s ? (
                    <p className="mt-4">
                      <TrackedFlowCtaButton
                        flow={s.flow}
                        href={s.href}
                        location="home_how_to_launch"
                        label={s.linkLabel}
                        variant="ghost"
                        className={linkClass}
                      >
                        {s.linkLabel} →
                      </TrackedFlowCtaButton>
                    </p>
                  ) : null}
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
