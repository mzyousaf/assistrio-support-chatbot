import { notFound } from "next/navigation";

import { BotChatPage } from "./BotChatPage";

import { connectToDatabase } from "@/lib/mongoose";
import { Bot } from "@/models/Bot";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DemoBotPage({ params }: PageProps) {
  const { slug } = await params;

  await connectToDatabase();
  const bot = await Bot.findOne({ slug, type: "showcase" }).lean();
  if (!bot) notFound();

  const serialized = {
    id: bot._id.toString(),
    slug: bot.slug,
    name: bot.name,
    shortDescription: bot.shortDescription ?? "",
    avatarEmoji: bot.avatarEmoji ?? "💬",
    imageUrl: bot.imageUrl ?? "",
    chatUI: bot.chatUI ?? undefined,
    mode: "demo" as const,
  };

  return <BotChatPage bot={serialized} />;
}
