import type { Metadata } from "next";
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LandingRouteTracker } from "@/components/analytics/landing-route-tracker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CtaFlowProvider } from "@/components/flows/cta-flow-context";
import { PlatformVisitorProvider } from "@/hooks/usePlatformVisitorId";
import { getMetadataBaseUrl, SITE_LOGO } from "@/lib/site-branding";
import { SITE_DEFAULT_DESCRIPTION } from "@/lib/site-metadata";

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
    apple: SITE_LOGO.sm,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} flex min-h-screen flex-col overflow-x-clip antialiased`}
      >
        <PlatformVisitorProvider>
          <CtaFlowProvider>
            <LandingRouteTracker />
            <SiteHeader />
            <main className="w-full min-w-0 flex-1">{children}</main>
            <SiteFooter />
          </CtaFlowProvider>
        </PlatformVisitorProvider>
      </body>
    </html>
  );
}
