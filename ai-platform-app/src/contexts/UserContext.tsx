"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";

/** Logged-in user (from User table). No role restriction. */
export type User = {
  id: string;
  email: string;
  role?: string;
  /** Workspace ids the user belongs to (from GET /api/user/me). */
  workspaceIds?: string[];
} | null;

/** Dedupes the bootstrap `/api/user/me` call (React Strict Mode runs effects twice in dev). */
let userMeBootstrapInflight: Promise<{ ok: boolean; user: User }> | null = null;

function resetUserMeBootstrapCache(): void {
  userMeBootstrapInflight = null;
}

async function fetchUserMeBootstrapOnce(): Promise<{ ok: boolean; user: User }> {
  if (!userMeBootstrapInflight) {
    userMeBootstrapInflight = (async () => {
      const res = await apiFetch("/api/user/me");
      if (!res.ok) {
        return { ok: false, user: null };
      }
      const user = await parseMeResponse(res);
      if (!user) {
        return { ok: false, user: null };
      }
      return { ok: true, user };
    })();
  }
  return userMeBootstrapInflight;
}

type UserContextValue = {
  user: User;
  loading: boolean;
  refetch: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

function isPublicAuthPath(pathname: string): boolean {
  return pathname === "/user/login" || pathname === "/admin/login";
}

async function parseMeResponse(res: Response): Promise<User> {
  const data = (await res.json()) as {
    id?: string;
    email?: string;
    role?: string;
    workspaceIds?: string[];
  };
  if (typeof data?.id === "string" && typeof data?.email === "string") {
    return {
      id: data.id,
      email: data.email,
      role: data.role,
      workspaceIds: Array.isArray(data.workspaceIds) ? data.workspaceIds : undefined,
    };
  }
  return null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  /** Manual refresh (e.g. after login). Uses current route for redirect rules. */
  const refetch = useCallback(async () => {
    resetUserMeBootstrapCache();
    setLoading(true);
    try {
      const res = await apiFetch("/api/user/me");
      if (!res.ok) {
        setUser(null);
        if (!isPublicAuthPath(pathname)) {
          router.replace("/user/login");
        }
        return;
      }
      const next = await parseMeResponse(res);
      if (next) {
        setUser(next);
      } else {
        setUser(null);
        if (!isPublicAuthPath(pathname)) {
          router.replace("/user/login");
        }
      }
    } catch {
      setUser(null);
      if (!isPublicAuthPath(pathname)) {
        router.replace("/user/login");
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  /** Single session bootstrap fetch — not repeated on tab or route changes. */
  useEffect(() => {
    let cancelled = false;
    const pathAtMount = pathname;

    void (async () => {
      try {
        const { ok, user: next } = await fetchUserMeBootstrapOnce();
        if (cancelled) return;
        if (!ok || !next) {
          setUser(null);
          if (!isPublicAuthPath(pathAtMount)) {
            router.replace("/user/login");
          }
          return;
        }
        setUser(next);
      } catch {
        if (cancelled) return;
        setUser(null);
        if (!isPublicAuthPath(pathAtMount)) {
          router.replace("/user/login");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally empty: one /api/user/me per full app load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ user, loading, refetch }), [user, loading, refetch]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
