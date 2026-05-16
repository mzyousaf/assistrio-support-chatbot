import type { ReactNode } from "react";

import { AdminUserGate } from "./admin-user-gate";
import { getServerUser } from "@/lib/serverAuth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const serverUser = await getServerUser();

  return (
    <>
      <AdminUserGate serverUser={serverUser} />
      {children}
    </>
  );
}
