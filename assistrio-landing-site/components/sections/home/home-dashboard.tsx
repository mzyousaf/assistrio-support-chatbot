import { Container } from "@/components/layout/container";
import { ProductFrameScreenshot } from "@/components/product/product-frame-screenshot";
import { ProductVisualFrame } from "@/components/product/product-visual-frame";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { HomeDashboardMock } from "@/components/sections/home/home-dashboard-mock";

const dashboardScreenshot =
  typeof process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD === "string"
    ? process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD.trim()
    : "";

/**
 * Product surface — bridges “how to start” and the definition section.
 * Real screenshot when `NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD` is set, else illustrative mock.
 */
export function HomeProductSurface() {
  return (
    <Section
      id="product"
      spacing="default"
      className="relative border-b border-[var(--border-default)] bg-[var(--background)]"
    >
      <Container size="wide">
        <ScrollReveal y={20}>
          <HomeSectionHeader
            id="product-heading"
            eyebrow="Workspace"
            title="Where you configure every AI Support Agent"
            titleWide
            align="split"
          >
            <p>
              This is where teams configure production <strong className="font-semibold text-slate-800">AI Support Agents</strong> on the hosted platform — prompts, knowledge,
              branding, and publish targets — before visitors ever see the runtime widget on your allowed websites.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <ScrollReveal y={26} delay={0.06} className="mt-14 lg:mt-16">
          <div className="relative mx-auto max-w-5xl">
            <div
              className="pointer-events-none absolute -inset-x-4 -inset-y-6 rounded-[2rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(13,148,136,0.09),transparent_65%)] sm:-inset-x-8"
              aria-hidden
            />
            <ProductVisualFrame
              addressBarLabel="app.assistrio.com · Acme · AI Support Agent"
              className="relative shadow-[var(--shadow-premium)] ring-1 ring-[var(--border-default)]"
            >
              <ProductFrameScreenshot
                src={dashboardScreenshot || undefined}
                alt="Assistrio workspace showing AI Support Agent configuration, knowledge, and publish controls"
                priority={false}
              >
                <HomeDashboardMock />
              </ProductFrameScreenshot>
            </ProductVisualFrame>
          </div>
        </ScrollReveal>

        <p className="text-meta mx-auto mt-8 max-w-2xl text-center">
          {dashboardScreenshot
            ? "Product UI — illustrative data; your workspace may differ."
            : "Illustrative UI — not your live workspace data."}
        </p>
      </Container>
    </Section>
  );
}
