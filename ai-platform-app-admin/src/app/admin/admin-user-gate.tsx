"use client";

import { useLayoutEffect } from "react";

import { useUser } from "@/hooks/useUser";
import type { ServerUser } from "@/lib/serverAuth";

/**
 * Applies the server-rendered `GET /api/admin/me` snapshot before paint so admin shells avoid
 * a long “loading” skeleton when middleware has already established a staff session.
 */
export function AdminUserGate({ serverUser }: { serverUser: ServerUser }) {
  const { applyServerSnapshot } = useUser();

  useLayoutEffect(() => {
    applyServerSnapshot(serverUser);
  }, [serverUser, applyServerSnapshot]);

  return null;
}
