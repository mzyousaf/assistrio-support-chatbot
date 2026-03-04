import { notFound } from "next/navigation";

import BotChatPage from "@/components/chat/BotChatPage";
import { connectToDatabase } from "@/lib/mongoose";
import { Bot } from "@/models/Bot";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TrialBotPage({ params }: PageProps) {
  const { slug } = await params;

  await connectToDatabase();
  const bot = await Bot.findOne({ slug, type: "visitor-own" }).lean();
  if (!bot) notFound();

  const serialized = {
    id: bot._id.toString(),
    slug: bot.slug,
    name: bot.name,
    shortDescription: bot.shortDescription ?? "",
    avatarEmoji: bot.avatarEmoji ?? "💬",
    imageUrl: bot.imageUrl ?? "",
    chatUI: bot.chatUI ?? undefined,
    mode: "trial" as const,
  };

  return <BotChatPage bot={serialized} />;
}
