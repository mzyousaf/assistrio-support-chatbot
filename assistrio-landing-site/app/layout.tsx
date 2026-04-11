import type { Metadata } from "next";
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LandingRouteTracker } from "@/components/analytics/landing-route-tracker";
import { RootMarketingChrome } from "@/components/layout/root-marketing-chrome";
import { CtaFlowProvider } from "@/components/flows/cta-flow-context";
import { PlatformVisitorProvider } from "@/hooks/usePlatformVisitorId";
import { validateTrialDashboardSession } from "@/lib/server/trial-session";
import { getMetadataBaseUrl, SITE_APPLE_TOUCH_ICON } from "@/lib/site-branding";
import { SITE_DEFAULT_DESCRIPTION } from "@/lib/site-metadata";
import { buildTrialSessionClientPayload } from "@/lib/trial/trial-session-display";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteTitleDefault = "AI Support Agents for your website";

export const metadata: Metadata = {
  metadataBase: getMetadataBaseUrl(),
  title: {
    default: siteTitleDefault,
    template: "%s · Assistrio",
  },
  description: SITE_DEFAULT_DESCRIPTION,
  applicationName: "Assistrio",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: SITE_APPLE_TOUCH_ICON,
  },
  openGraph: {
    type: "website",
    siteName: "Assistrio",
    locale: "en_US",
    title: `${siteTitleDefault} · Assistrio`,
    description: SITE_DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Assistrio — Hosted AI Support Agents for your website",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteTitleDefault} · Assistrio`,
    description: SITE_DEFAULT_DESCRIPTION,
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/** Fresh session + layout on every request (trial cookie must be visible on `/` with path `/`). */
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const trialSessionRecord = await validateTrialDashboardSession();
  const trialSessionClient = trialSessionRecord
    ? buildTrialSessionClientPayload(trialSessionRecord)
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${sans.variable} ${display.variable} ${mono.variable} flex min-h-screen flex-col overflow-x-clip antialiased`}
      >
        <PlatformVisitorProvider>
          <CtaFlowProvider trialSessionClient={trialSessionClient}>
            <LandingRouteTracker />
            <RootMarketingChrome trialSessionClient={trialSessionClient}>{children}</RootMarketingChrome>
          </CtaFlowProvider>
        </PlatformVisitorProvider>
      </body>
    </html>
  );
}
