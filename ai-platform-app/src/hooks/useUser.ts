"use client";

import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Logged-in user (from User table). No role restriction. */
export type User = {
  id: string;
  email: string;
  role?: string;
  /** Workspace ids the user belongs to (from GET /api/user/me). */
  workspaceIds?: string[];
} | null;

export function useUser(): { user: User; loading: boolean } {
  const router = useRouter();
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/user/me")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          router.replace("/user/login");
          return;
        }
        const data = (await res.json()) as {
          id?: string;
          email?: string;
          role?: string;
          workspaceIds?: string[];
        };
        if (typeof data?.id === "string" && typeof data?.email === "string") {
          setUser({
            id: data.id,
            email: data.email,
            role: data.role,
            workspaceIds: Array.isArray(data.workspaceIds) ? data.workspaceIds : undefined,
          });
        } else {
          router.replace("/user/login");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/user/login");
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
