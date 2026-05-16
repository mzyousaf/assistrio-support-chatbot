import { Container } from "@/components/layout/container";
import { ProductFrameScreenshot } from "@/components/product/product-frame-screenshot";
import { ProductVisualFrame } from "@/components/product/product-visual-frame";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { HomeDashboardMock } from "@/components/sections/home/home-dashboard-mock";
import { HomeWidgetScene } from "@/components/sections/home/home-widget-scene";

const dashboardScreenshot =
  typeof process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD === "string"
    ? process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD.trim()
    : "";

const widgetScreenshot =
  typeof process.env.NEXT_PUBLIC_HOME_SCREENSHOT_WIDGET_SCENE === "string"
    ? process.env.NEXT_PUBLIC_HOME_SCREENSHOT_WIDGET_SCENE.trim()
    : "";

export function HomeProductProof() {
  return (
    <Section
      id="product-proof"
      spacing="default"
      className="relative border-b border-[var(--border-default)] bg-[var(--background)]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(13,148,136,0.08),transparent_70%)]"
        aria-hidden
      />
      <Container size="wide" className="relative">
        <ScrollReveal y={20}>
          <HomeSectionHeader id="product-proof-heading" eyebrow="Product" title="See the full AI Support Agent experience" titleWide align="split">
            <p>
              Purely visual: the operator shell and the visitor surface side by side. Capabilities were defined upstream — here you only compare scale and framing.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-12">
          <ScrollReveal y={24}>
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(13,148,136,0.1),transparent_65%)]"
                aria-hidden
              />
              <ProductVisualFrame
                addressBarLabel="app.assistrio.com · Workspace · AI Support Agent"
                className="relative shadow-[var(--shadow-premium)] ring-1 ring-[var(--border-default)]"
              >
                <ProductFrameScreenshot
                  src={dashboardScreenshot || undefined}
                  alt="Assistrio dashboard for configuring an AI Support Agent"
                  priority={false}
                >
                  <HomeDashboardMock />
                </ProductFrameScreenshot>
              </ProductVisualFrame>
              <p className="text-meta mt-4 text-center">
                {dashboardScreenshot ? "Product UI — illustrative data; your workspace may differ." : "Illustrative UI — not your live workspace data."}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal y={24} delay={0.06}>
            <div className="relative lg:pt-4">
              <HomeWidgetScene screenshotSrc={widgetScreenshot || undefined} />
              <p className="text-meta mt-4 text-center">
                {widgetScreenshot ? "Runtime widget on your site — same path you ship in production." : "Illustrative widget — configure branding and behavior in the workspace."}
              </p>
            </div>
          </ScrollReveal>
        </div>

      </Container>
    </Section>
  );
}
