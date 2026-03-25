import Link from "next/link";
import type { PublicBotPreview } from "@/types/home";
import { cn } from "@/lib/cn";

type BotPreviewCardProps = {
  bot: PublicBotPreview;
  className?: string;
};

export function BotPreviewCard({ bot, className }: BotPreviewCardProps) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm transition hover:border-brand/30 hover:shadow-md",
        className,
      )}
    >
      <h3 className="text-lg font-semibold text-neutral-900">{bot.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">
        {bot.description}
      </p>
      <Link
        href={bot.href}
        className="mt-5 inline-flex w-fit items-center text-sm font-semibold text-brand hover:underline"
      >
        Open demo
      </Link>
    </article>
  );
}
