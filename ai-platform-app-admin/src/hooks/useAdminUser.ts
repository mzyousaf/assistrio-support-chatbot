"use client";

/**
 * Operator session — same as {@link useUser}; staff bootstrap uses `GET /api/admin/me`.
 */
import { useUser } from "./useUser";

export type AdminUser = { id: string; email: string; role?: string } | null;

export function useAdminUser(): { user: AdminUser; loading: boolean } {
  return useUser();
}
