"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";

export type ProductFrameScreenshotProps = {
  /** Public path (e.g. `/marketing/dashboard.png`) or absolute URL — empty/undefined shows `children` */
  src?: string | null;
  alt: string;
  children: ReactNode;
  /** Default aspect matches homepage hero product shots */
  aspectClassName?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Image fit when using a screenshot */
  imageClassName?: string;
};

/**
 * Renders a `next/image` when `src` loads; on missing URL, load error, or empty asset, renders `children` (mock UI).
 */
export function ProductFrameScreenshot({
  src,
  alt,
  children,
  aspectClassName = "aspect-[16/10]",
  className = "",
  priority = false,
  sizes = "(max-width: 1024px) 100vw, min(896px, 1200px)",
  imageClassName = "object-cover object-top",
}: ProductFrameScreenshotProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = typeof src === "string" ? src.trim() : "";
  const showImage = Boolean(trimmed) && !failed;

  if (!showImage) {
    return <>{children}</>;
  }

  return (
    <div className={`relative w-full ${className}`.trim()}>
      <div className={`relative w-full bg-slate-100 ${aspectClassName}`}>
        <Image
          src={trimmed}
          alt={alt}
          fill
          sizes={sizes}
          className={imageClassName}
          priority={priority}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}
