"use client";

import Image from "next/image";
import Link from "next/link";
import { SITE_LOGO_MARK, SITE_LOGO_MARK_PX, SITE_LOGO_TEXT, SITE_LOGO_TEXT_PX } from "@/lib/site-branding";

type Props = {
  href?: string;
  title?: string;
  className?: string;
};

/**
 * Brand mark + `logo-text.png` wordmark for marketing header and trial dashboard header.
 */
export function SiteBrandLogoLink({ href = "/", title = "Assistrio — home", className = "" }: Props) {
  return (
    <Link
      href={href}
      title={title}
      className={`flex min-w-0 shrink-0 items-center gap-2 transition-opacity duration-150 hover:opacity-85 sm:gap-2.5 ${className}`}
    >
      <Image
        src={SITE_LOGO_MARK}
        alt=""
        width={SITE_LOGO_MARK_PX.width}
        height={SITE_LOGO_MARK_PX.height}
        className="h-8 w-8 shrink-0 rounded-md object-contain sm:h-9 sm:w-9"
        priority
        aria-hidden
      />
      <Image
        src={SITE_LOGO_TEXT}
        alt="Assistrio"
        width={SITE_LOGO_TEXT_PX.width}
        height={SITE_LOGO_TEXT_PX.height}
        className="h-[1.125rem] w-auto max-w-[min(100%,9rem)] shrink-0 self-center object-contain object-left sm:h-[1.3125rem] sm:max-w-[min(100%,10rem)]"
        priority
      />
    </Link>
  );
}
