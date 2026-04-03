"use client";

import { UserProvider } from "@/contexts/UserContext";

import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground font-sans">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
