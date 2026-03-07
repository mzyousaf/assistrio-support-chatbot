"use client";

import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type SuperAdmin = { id: string; email: string } | null;

export function useSuperAdmin(): { user: SuperAdmin; loading: boolean } {
  const router = useRouter();
  const [user, setUser] = useState<SuperAdmin>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/super-admin/me")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          router.replace("/super-admin/login");
          return;
        }
        const data = (await res.json()) as { id?: string; email?: string };
        if (typeof data?.id === "string" && typeof data?.email === "string") {
          setUser({ id: data.id, email: data.email });
        } else {
          router.replace("/super-admin/login");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/super-admin/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { user, loading };
}
