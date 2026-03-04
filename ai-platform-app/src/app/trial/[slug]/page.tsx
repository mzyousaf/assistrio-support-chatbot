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
    faqs: Array.isArray(bot.faqs)
      ? bot.faqs.map((faq) => ({
          question: String(faq?.question ?? "").trim(),
          answer: String(faq?.answer ?? "").trim(),
        }))
      : [],
    exampleQuestions: Array.isArray(bot.exampleQuestions)
      ? bot.exampleQuestions.map((question) => String(question || "").trim()).filter(Boolean)
      : [],
    mode: "trial" as const,
  };

  return <BotChatPage bot={serialized} />;
}
