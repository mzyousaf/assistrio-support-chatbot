import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistrio AI",
  description: "Custom data chatbots landing site",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50">
        <div className="mx-auto min-h-screen w-full max-w-5xl px-6">{children}</div>
      </body>
    </html>
  );
}
