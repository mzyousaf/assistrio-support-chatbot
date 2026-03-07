import { cookies } from "next/headers";
import { serverApiFetch } from "./api";

export type ServerSuperAdmin = { id: string; email: string } | null;

/**
 * Get the current super-admin from the backend using the request cookie.
 * Returns null if unauthenticated or backend unavailable. Use in server components.
 */
export async function getServerSuperAdmin(): Promise<ServerSuperAdmin> {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  if (!cookie) return null;
  try {
    const res = await serverApiFetch("/api/super-admin/me", { cookie });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; email?: string };
    if (typeof data?.id === "string" && typeof data?.email === "string") {
      return { id: data.id, email: data.email };
    }
    return null;
  } catch {
    return null;
  }
}
