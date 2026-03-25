import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AssistrioGlobalEmbed } from "@/components/AssistrioGlobalEmbed";
import { SiteChrome } from "@/components/SiteChrome";
import { siteMeta } from "@/content/site";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${siteMeta.name} — ${siteMeta.tagline}`,
    template: `%s — ${siteMeta.name}`,
  },
  description:
    "Custom AI support agents for your website—trained on your FAQs, docs, and business knowledge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://widget.assistrio.com/assistrio-chat.css"
        />
      </head>
      <body className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
        <AssistrioGlobalEmbed />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
