"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import type { ServerUser } from "@/lib/serverAuth";

/** Logged-in staff (superadmin) from `GET /api/admin/me`. */
export type User = {
  id: string;
  email: string;
  role?: string;
  /** Workspace ids (personal workspace ensured by backend). */
  workspaceIds?: string[];
} | null;

/** Dedupes bootstrap `GET /api/admin/me` (React Strict Mode runs effects twice in dev). */
let userMeBootstrapInflight: Promise<{ ok: boolean; user: User }> | null = null;

function resetUserMeBootstrapCache(): void {
  userMeBootstrapInflight = null;
}

async function fetchUserMeBootstrapOnce(): Promise<{ ok: boolean; user: User }> {
  if (!userMeBootstrapInflight) {
    userMeBootstrapInflight = (async () => {
      const res = await apiFetch("/api/admin/me");
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
  /** Admin RSC snapshot — skips client bootstrap flicker on `/admin/*`. */
  applyServerSnapshot: (snapshot: ServerUser) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

function isPublicAuthPath(pathname: string): boolean {
  // `/user/login` may still appear briefly before `next.config` redirects to `/admin/login`.
  return pathname === "/admin/login" || pathname === "/user/login";
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
  const serverHydratedRef = useRef(false);

  const applyServerSnapshot = useCallback((snapshot: ServerUser) => {
    serverHydratedRef.current = true;
    resetUserMeBootstrapCache();
    setUser(snapshot);
    setLoading(false);
  }, []);

  /** Manual refresh (e.g. after login). */
  const refetch = useCallback(async () => {
    serverHydratedRef.current = false;
    resetUserMeBootstrapCache();
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/me");
      if (!res.ok) {
        setUser(null);
        if (!isPublicAuthPath(pathname)) {
          router.replace("/admin/login");
        }
        return;
      }
      const next = await parseMeResponse(res);
      if (next) {
        setUser(next);
      } else {
        setUser(null);
        if (!isPublicAuthPath(pathname)) {
          router.replace("/admin/login");
        }
      }
    } catch {
      setUser(null);
      if (!isPublicAuthPath(pathname)) {
        router.replace("/admin/login");
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
      if (serverHydratedRef.current) {
        return;
      }
      try {
        const { ok, user: next } = await fetchUserMeBootstrapOnce();
        if (cancelled) return;
        if (!ok || !next) {
          setUser(null);
          if (!isPublicAuthPath(pathAtMount)) {
            router.replace("/admin/login");
          }
          return;
        }
        setUser(next);
      } catch {
        if (cancelled) return;
        setUser(null);
        if (!isPublicAuthPath(pathAtMount)) {
          router.replace("/admin/login");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, loading, refetch, applyServerSnapshot }),
    [user, loading, refetch, applyServerSnapshot],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
