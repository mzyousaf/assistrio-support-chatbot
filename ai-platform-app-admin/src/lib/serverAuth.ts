import { cookies } from "next/headers";
import { fetchAdminMe, parseAdminMeResponse, type AdminMePayload } from "./adminSessionVerify";

/** Logged-in staff from `GET /api/admin/me` (superadmin). */
export type ServerUser = AdminMePayload | null;

/**
 * Current user for server components — uses cookies forwarded to the Nest API.
 */
export async function getServerUser(): Promise<ServerUser> {
  const cookieStore = await cookies();
  const pairs = cookieStore.getAll();
  if (pairs.length === 0) return null;
  const cookieHeader = pairs.map((c) => `${c.name}=${c.value}`).join("; ");
  try {
    const res = await fetchAdminMe(cookieHeader);
    return await parseAdminMeResponse(res);
  } catch {
    return null;
  }
}
