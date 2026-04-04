import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LandingRouteTracker } from "@/components/analytics/landing-route-tracker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PlatformVisitorProvider } from "@/hooks/usePlatformVisitorId";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
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
    "Create and test AI support bots from your knowledge base. Showcase demos, free trials, and domain-safe runtime embeds.",
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
          <LandingRouteTracker />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </PlatformVisitorProvider>
      </body>
    </html>
  );
}
