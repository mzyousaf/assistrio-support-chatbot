import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { GalleryGridClient } from "@/components/sections/gallery/gallery-grid-client";
import type { PublicBotListItem } from "@/types/bot";

type Props = {
  bots: PublicBotListItem[];
  /** When set with a non-empty list, renders inside the gallery hero above search & filters. */
  children?: ReactNode;
};

/**
 * Public showcase AI Agents only (`GET /api/public/bots`). Fields come from the API — no invented metadata.
 */
export function GalleryGrid({ bots, children }: Props) {
  if (bots.length === 0) {
    return (
      <EmptyState title="No showcase AI Agents to display">
        <p>
          The API returned an empty list. Publish public showcase AI Agents in the Assistrio admin, and ensure{" "}
          <code className="rounded bg-white px-1 text-xs">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> points at your
          backend.
        </p>
      </EmptyState>
    );
  }

  return <GalleryGridClient bots={bots}>{children}</GalleryGridClient>;
}
