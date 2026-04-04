import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { HomeWidgetScene } from "@/components/sections/home/home-widget-scene";

const benefits = [
  {
    title: "Origin-aware",
    body: "Each init sends your page hostname; allowlists and keys are checked before the session opens.",
  },
  {
    title: "Runtime, not preview",
    body: "Customers get the same public API path you’ll ship — distinct from owner preview inside Assistrio.",
  },
  {
    title: "Aligned with policy",
    body: "Replies and quota follow the bot you published — escalation and tone stay under your rules.",
  },
];

const widgetScreenshot =
  typeof process.env.NEXT_PUBLIC_HOME_SCREENSHOT_WIDGET_SCENE === "string"
    ? process.env.NEXT_PUBLIC_HOME_SCREENSHOT_WIDGET_SCENE.trim()
    : "";

/**
 * Runtime widget — real screenshot when `NEXT_PUBLIC_HOME_SCREENSHOT_WIDGET_SCENE` is set (composite: page + widget), else illustrative mock.
 */
export function HomeWidgetShowcase() {
  return (
    <Section id="widget" tone="muted" className="relative border-b border-[var(--border-default)]">
      <Container>
        <HomeSectionHeader id="widget-heading" eyebrow="Runtime" title="The chat your customers see">
          <p className="max-w-2xl text-base leading-relaxed">
            On your site, the widget runs in <strong className="font-medium text-slate-800">runtime</strong> mode — not
            the Assistrio preview shell. The browser sends your page origin on init; the API enforces allowlists and keys;
            messages and quota follow your bot rules.
          </p>
        </HomeSectionHeader>

        <div className="relative mx-auto mt-12 max-w-3xl">
          <HomeWidgetScene screenshotSrc={widgetScreenshot || undefined} />
        </div>

        <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-5">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white/95 p-5 shadow-[var(--shadow-xs)] transition-shadow duration-200 hover:shadow-[var(--shadow-sm)]"
            >
              <h3 className="text-sm font-semibold text-slate-900">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{b.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-[var(--foreground-muted)] sm:mt-10">
          {widgetScreenshot
            ? "Screenshot — your embed styling and copy follow your bot configuration."
            : "Mock conversation — embed behavior depends on your bot config and hostname allowlist."}
        </p>
      </Container>
    </Section>
  );
}
