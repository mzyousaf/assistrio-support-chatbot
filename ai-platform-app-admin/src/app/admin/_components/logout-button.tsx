"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiFetch("/api/admin/auth/logout", {
        method: "POST",
      });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={() => void handleLogout()} className="text-sm text-slate-300 hover:text-white">
      Log out
    </button>
  );
}
