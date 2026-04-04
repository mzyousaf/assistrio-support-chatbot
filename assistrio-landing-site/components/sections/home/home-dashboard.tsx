import { Container } from "@/components/layout/container";
import { ProductFrameScreenshot } from "@/components/product/product-frame-screenshot";
import { ProductVisualFrame } from "@/components/product/product-visual-frame";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { HomeDashboardMock } from "@/components/sections/home/home-dashboard-mock";

const dashboardScreenshot =
  typeof process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD === "string"
    ? process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD.trim()
    : "";

/**
 * Product surface — real screenshot when `NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD` is set, else illustrative mock.
 */
export function HomeDashboard() {
  return (
    <Section id="dashboard" className="relative border-b border-[var(--border-default)] bg-white">
      <Container>
        <HomeSectionHeader id="dashboard-heading" eyebrow="Product" title="One dashboard for your support bot">
          <p className="max-w-2xl text-base leading-relaxed">
            Draft content, wire knowledge, and publish — all in Assistrio workspaces. Your customers never see this shell;
            they only load the <strong className="font-medium text-slate-800">runtime widget</strong> on your domain.
          </p>
        </HomeSectionHeader>

        <ProductVisualFrame addressBarLabel="app.assistrio.com · Acme · Support bot">
          <ProductFrameScreenshot
            src={dashboardScreenshot || undefined}
            alt="Assistrio dashboard showing bot workspace, knowledge, and publish controls"
            priority
          >
            <HomeDashboardMock />
          </ProductFrameScreenshot>
        </ProductVisualFrame>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-[var(--foreground-muted)]">
          {dashboardScreenshot
            ? "Product UI — illustrative data; your workspace may differ."
            : "Illustrative UI — not your live workspace data."}
        </p>
      </Container>
    </Section>
  );
}
