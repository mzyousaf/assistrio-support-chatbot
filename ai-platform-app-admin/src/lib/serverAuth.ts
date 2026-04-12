import { cookies } from "next/headers";
import { serverApiFetch } from "./api";

/** Logged-in user (from User table). No role restriction. */
export type ServerUser = { id: string; email: string; role?: string } | null;

/**
 * Get the current user from the backend using the request cookie.
 * Returns null if unauthenticated or backend unavailable. Use in server components.
 */
export async function getServerUser(): Promise<ServerUser> {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  if (!cookie) return null;
  try {
    const res = await serverApiFetch("/api/user/me", { cookie });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; email?: string; role?: string };
    if (typeof data?.id === "string" && typeof data?.email === "string") {
      return { id: data.id, email: data.email, role: data.role };
    }
    return null;
  } catch {
    return null;
  }
}
