"use client";

import { buttonBaseClass, buttonVariantClass } from "@/components/ui/button";
import { useCtaFlow } from "@/components/flows/cta-flow-context";
import { useTrackEvent } from "@/hooks/useTrackEvent";

type Props = {
  slug: string;
  botName: string;
};

export function GalleryDemoLink({ slug, botName }: Props) {
  const { openShowcase } = useCtaFlow();
  const { track } = useTrackEvent();
  return (
    <button
      type="button"
      onClick={() => {
        const href = `/bots/${encodeURIComponent(slug)}`;
        track("cta_clicked", { location: "gallery_card", label: "View demo", href });
        track("demo_opened", { slug, botName, href });
        openShowcase(slug);
      }}
      className={`${buttonBaseClass} ${buttonVariantClass.primary} w-full justify-center text-sm`}
    >
      View demo
    </button>
  );
}
