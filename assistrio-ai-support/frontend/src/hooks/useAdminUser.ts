"use client";

/**
 * Re-exports useUser for admin panel. Use useUser and /user routes for new code.
 */
import { useUser } from "./useUser";

export type AdminUser = { id: string; email: string; role?: string } | null;

export function useAdminUser(): { user: AdminUser; loading: boolean } {
  return useUser();
}
