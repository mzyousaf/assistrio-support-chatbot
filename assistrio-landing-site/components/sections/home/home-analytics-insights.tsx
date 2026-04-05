"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const bars = [72, 48, 88, 56, 100, 64, 80, 44, 92, 60, 76, 52];

export function HomeAnalyticsInsights() {
  return (
    <Section id="analytics-insights" spacing="snug" className="border-b border-[var(--border-default)] bg-white">
      <Container>
        <div className="lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-12 xl:gap-x-16">
          <div className="lg:col-span-5">
            <HomeSectionHeader id="analytics-insights-heading" eyebrow="Analytics" title="Understand what your visitors are asking" titleWide>
              <p>
                Volume, topics, sentiment, and purpose of chats — in charts and summaries built for operators reviewing transcripts, not for vanity dashboards. We do not re-litigate
                leads or branding here; those have their own sections.
              </p>
            </HomeSectionHeader>
          </div>

          <div className="relative mt-14 lg:col-span-7 lg:mt-0">
            <div
              className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[radial-gradient(ellipse_80%_70%_at_50%_100%,rgba(13,148,136,0.12),transparent_65%)]"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-gradient-to-b from-slate-50/95 to-white p-6 shadow-[var(--shadow-premium)] ring-1 ring-[var(--border-default)] sm:p-8"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
                <div>
                  <h4 className="text-home-h4 text-[0.9375rem] text-slate-900">Conversation volume</h4>
                  <p className="text-meta mt-0.5">Illustrative layout — not live data</p>
                </div>
                <span className="rounded-full bg-[var(--brand-teal-subtle)] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">
                  Insights
                </span>
              </div>
              <div className="mt-6 flex h-48 items-end justify-between gap-1.5 sm:h-56 sm:gap-2" role="img" aria-label="Decorative bar chart placeholder">
                {bars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                    className="min-w-0 flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-[var(--brand-teal)]/85 to-[var(--brand-teal)]/35"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[var(--border-default)] pt-5 text-center">
                {["Topics", "Sentiment", "Chat purpose"].map((label) => (
                  <div key={label} className="rounded-lg bg-[var(--surface-muted)]/60 py-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">{label}</p>
                    <p className="mt-1 text-xs text-[var(--foreground-muted)]">Summary views</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
