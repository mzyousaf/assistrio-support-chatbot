import type { Metadata } from "next";
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LandingRouteTracker } from "@/components/analytics/landing-route-tracker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CtaFlowProvider } from "@/components/flows/cta-flow-context";
import { PlatformVisitorProvider } from "@/hooks/usePlatformVisitorId";

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

export const metadata: Metadata = {
  title: {
    default: "Assistrio — AI support chat",
    template: "%s · Assistrio",
  },
  description:
    "Explore Assistrio on your own allowed website, browse live gallery examples, and launch production AI support when you are ready — runtime embeds locked to allowed websites.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} flex min-h-screen flex-col antialiased`}
      >
        <PlatformVisitorProvider>
          <CtaFlowProvider>
            <LandingRouteTracker />
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </CtaFlowProvider>
        </PlatformVisitorProvider>
      </body>
    </html>
  );
}
