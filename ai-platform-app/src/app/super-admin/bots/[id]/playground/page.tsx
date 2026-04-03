"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { getBotsBasePath } from "@/components/admin/admin-shell-config";
import { InlineRedirectSkeleton } from "@/components/ui/Skeleton";

export default function PlaygroundIndexRedirect() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const botId = typeof params?.id === "string" ? params.id : "";

  useEffect(() => {
    if (!botId) return;
    const base = getBotsBasePath(pathname);
    router.replace(`${base}/${botId}/playground/profile`);
  }, [botId, pathname, router]);

  return <InlineRedirectSkeleton />;
}
