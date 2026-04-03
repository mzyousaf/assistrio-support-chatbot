"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

function displayInitials(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  const alnum = name.replace(/\s/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return (name.slice(0, 2) || "A").toUpperCase();
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export type LandingBotAvatarSize = "card" | "detail" | "preview";

type LandingBotAvatarProps = {
  name: string;
  imageUrl?: string;
  avatarEmoji?: string;
  /** `card` = /bots grid; `detail` = slug page header; `preview` = home section cards */
  size?: LandingBotAvatarSize;
  className?: string;
};

export function LandingBotAvatar({
  name,
  imageUrl,
  avatarEmoji,
  size = "card",
  className,
}: LandingBotAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const raw = imageUrl?.trim() ?? "";
  const showImg = Boolean(raw && !imgFailed && isHttpUrl(raw));

  const imgClass =
    size === "detail"
      ? "h-24 w-24 shrink-0 rounded-2xl object-cover shadow-md ring-2 ring-white sm:h-28 sm:w-28"
      : size === "preview"
        ? "h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-neutral-100"
        : "h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-neutral-100 transition group-hover:ring-brand/20";

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={raw}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(imgClass, className)}
        onError={() => setImgFailed(true)}
      />
    );
  }

  if (avatarEmoji) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          size === "detail"
            ? "h-24 w-24 rounded-2xl bg-white text-5xl shadow-inner ring-2 ring-brand/15 sm:h-28 sm:w-28"
            : size === "preview"
              ? "h-12 w-12 rounded-xl bg-gradient-to-br from-brand-muted to-white text-xl ring-1 ring-neutral-100"
              : "h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-muted to-white text-2xl ring-1 ring-neutral-100",
          className,
        )}
        aria-hidden
      >
        {avatarEmoji}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-bold text-brand/90",
        size === "detail"
          ? "h-24 w-24 rounded-2xl bg-gradient-to-br from-brand/20 to-brand-muted/40 text-base sm:h-28 sm:w-28"
          : size === "preview"
            ? "h-12 w-12 rounded-xl bg-gradient-to-br from-brand/15 to-brand-muted/30 text-xs ring-1 ring-neutral-100"
            : "h-14 w-14 rounded-2xl bg-gradient-to-br from-brand/15 to-brand-muted/30 text-sm ring-1 ring-neutral-100",
        className,
      )}
      aria-hidden
    >
      {displayInitials(name)}
    </span>
  );
}
