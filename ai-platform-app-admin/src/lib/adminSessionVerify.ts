/**
 * Shared admin session checks (Edge middleware + server components).
 * Validates staff via the backend `GET /api/admin/me` contract — same as the browser.
 */

const ADMIN_ME_PATH = "/api/admin/me";

export function getBackendApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim().replace(/\/$/, "") : "";
}

/** Forward browser cookies to the Nest API (admin cookie or legacy superadmin `user_token`). */
export function fetchAdminMe(cookieHeader: string | null | undefined): Promise<Response> {
  const base = getBackendApiBase();
  const url = base ? `${base}${ADMIN_ME_PATH}` : ADMIN_ME_PATH;
  const headers = new Headers();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  return fetch(url, { headers, cache: "no-store" });
}

export type AdminMePayload = {
  id: string;
  email: string;
  role?: string;
  workspaceIds?: string[];
};

export async function parseAdminMeResponse(res: Response): Promise<AdminMePayload | null> {
  if (!res.ok) return null;
  try {
    const data = (await res.json()) as {
      id?: string;
      email?: string;
      role?: string;
      workspaceIds?: string[];
    };
    if (typeof data?.id !== "string" || typeof data?.email !== "string") return null;
    if (data.role !== "superadmin") return null;
    return {
      id: data.id,
      email: data.email,
      role: data.role,
      workspaceIds: Array.isArray(data.workspaceIds) ? data.workspaceIds : undefined,
    };
  } catch {
    return null;
  }
}

/** Fast cookie presence check before hitting the API (legacy superadmin may only have `user_token`). */
export function mayHaveStaffSessionCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.includes("ar_admin_session=") || cookieHeader.includes("user_token=");
}

export async function verifyAdminSession(cookieHeader: string | null | undefined): Promise<boolean> {
  if (!getBackendApiBase()) return false;
  if (!mayHaveStaffSessionCookie(cookieHeader)) return false;
  const res = await fetchAdminMe(cookieHeader);
  const user = await parseAdminMeResponse(res);
  return user != null;
}
