"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  hash: "files" | "notes" | "faqs";
};

export function TrialKnowledgeHashRedirect({ hash }: Props) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/trial/dashboard/playground/knowledge#${hash}`);
  }, [hash, router]);
  return null;
}
