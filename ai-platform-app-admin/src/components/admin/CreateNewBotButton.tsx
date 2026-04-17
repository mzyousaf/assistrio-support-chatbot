"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { rotateDraftId } from "@/lib/draftBot";

interface CreateNewBotButtonProps {
  className?: string;
  label?: string;
}

export default function CreateNewBotButton({
  className,
  label = "Create bot",
}: CreateNewBotButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={
        className ??
        "inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
      }
      onClick={() => {
        rotateDraftId();
        router.push("/admin/bots/new?new=1");
      }}
    >
      {label}
    </button>
  );
}
