import Link from "next/link";
import { LandingBotAvatar } from "@/components/bots/landing-bot-avatar";
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
      <div className="flex items-start gap-3">
        <LandingBotAvatar
          name={bot.name}
          imageUrl={bot.imageUrl}
          avatarEmoji={bot.avatarEmoji}
          size="preview"
        />
        <h3 className="min-w-0 flex-1 text-lg font-semibold leading-snug text-neutral-900">{bot.name}</h3>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-600">
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
