"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductVisualFrame } from "@/components/product/product-visual-frame";
import { HomeWidgetMock } from "@/components/sections/home/home-widget-mock";

type Props = {
  /** Public path under `/public` or allowed remote URL — omit for mock-only */
  screenshotSrc?: string | null;
};

/**
 * Switches between a real widget-scene screenshot and the illustrative mock without double-framing.
 */
export function HomeWidgetScene({ screenshotSrc }: Props) {
  const [failed, setFailed] = useState(false);
  const trimmed = typeof screenshotSrc === "string" ? screenshotSrc.trim() : "";
  const showImage = Boolean(trimmed) && !failed;

  if (!showImage) {
    return <HomeWidgetMock />;
  }

  return (
    <ProductVisualFrame chrome="none">
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        <Image
          src={trimmed}
          alt="Assistrio chat widget on a customer website"
          fill
          className="object-cover object-top"
          sizes="(max-width: 1024px) 100vw, min(896px, 1200px)"
          onError={() => setFailed(true)}
        />
      </div>
    </ProductVisualFrame>
  );
}
