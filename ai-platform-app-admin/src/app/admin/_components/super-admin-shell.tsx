"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { LogoutButton } from "./logout-button";

type AdminShellLayoutProps = {
  children: ReactNode;
};

export function AdminShellLayout({ children }: AdminShellLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between p-4">
          <p className="font-semibold">Assistrio AI - Super Admin</p>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl p-4">{children}</div>
    </div>
  );
}
