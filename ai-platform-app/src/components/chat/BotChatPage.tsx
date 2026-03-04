"use client";

import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { useVisitorId } from "@/hooks/useVisitorId";
import type { BotChatUI } from "@/models/Bot";

type BotChatProps = {
  bot: {
    id: string;
    slug: string;
    name: string;
    shortDescription?: string;
    avatarEmoji?: string;
    imageUrl?: string;
    chatUI?: BotChatUI;
    mode: "demo" | "trial";
  };
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toRgba(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return `rgba(20, 184, 166, ${alpha})`;
  }
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function BotChatPage({ bot }: BotChatProps) {
  const { visitorId } = useVisitorId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendDisabled = loading || limitReached || !input.trim() || !visitorId;
  const primaryColor =
    typeof bot.chatUI?.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(bot.chatUI.primaryColor)
      ? bot.chatUI.primaryColor
      : "#14B8A6";
  const bubbleRadius = bot.chatUI?.bubbleStyle === "squared" ? 6 : 16;
  const chatFont =
    bot.chatUI?.font === "poppins"
      ? "Poppins, ui-sans-serif, system-ui, sans-serif"
      : bot.chatUI?.font === "system"
        ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        : "Inter, ui-sans-serif, system-ui, sans-serif";
  const pageBackground =
    bot.chatUI?.backgroundStyle === "light" ? "bg-slate-100 text-slate-900" : "bg-slate-950 text-slate-50";
  const cardBackground = bot.chatUI?.backgroundStyle === "light" ? "bg-white border-slate-200" : "bg-slate-900 border-slate-700";
  const wrapperStyle = {
    "--chat-primary": primaryColor,
    "--chat-radius": `${bubbleRadius}px`,
    fontFamily: chatFont,
  } as React.CSSProperties;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!visitorId || !input.trim() || loading || limitReached) return;

    const userContent = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userContent }]);
    setInput("");
    setLoading(true);

    try {
      const endpoint = bot.mode === "demo" ? "/api/demo/chat" : "/api/trial/chat";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botSlug: bot.slug,
          message: userContent,
          visitorId,
        }),
      });

      if (res.status === 403) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        if (data?.error === "limit_reached") {
          setLimitReached(true);
          const msg = data?.message ?? "You reached the free limit.";
          setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
          return;
        }
      }

      if (res.status === 429) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        const msg = data?.message ?? "You are sending messages too fast. Please wait a moment.";
        setError(msg);
        return;
      }

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }

      const data = (await res.json()) as { reply?: string };
      const reply = data?.reply ?? "No reply.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cx("min-h-screen flex flex-col", pageBackground)} style={wrapperStyle}>
      <div
        className={cx(
          "border-b px-4 md:px-8 py-4 flex items-center gap-3",
          bot.chatUI?.backgroundStyle === "light" ? "border-slate-200" : "border-slate-800",
        )}
      >
        <div className={cx("h-10 w-10 flex items-center justify-center rounded-xl border text-2xl", cardBackground)}>
          {bot.avatarEmoji || "💬"}
        </div>
        <div className="flex-1">
          <h1 className="text-base md:text-lg font-semibold">{bot.name}</h1>
          <p className="text-xs text-slate-400">
            {bot.mode === "demo" ? "Showcase demo bot" : "Your trial bot"}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 md:px-0 py-4 gap-3">
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {messages.length === 0 && (
            <p className="text-sm text-slate-500 text-center mt-8">
              Ask a question to start the conversation.
            </p>
          )}
          {messages.map((m, idx) => (
            <div key={idx} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cx(
                  "max-w-[80%] px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-slate-200 text-slate-900"
                    : cx(
                        "border border-slate-700",
                        bot.chatUI?.backgroundStyle === "light" ? "text-slate-900" : "text-slate-50",
                      ),
                )}
                style={{
                  borderRadius: `var(--chat-radius)`,
                  backgroundColor: m.role === "user" ? undefined : toRgba(primaryColor, 0.35),
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {limitReached && (
          <div className="mb-2">
            <Card>
              <h2 className="text-sm font-semibold text-slate-50">Free limit reached</h2>
              <p className="text-xs text-slate-400 mt-1">
                You&apos;ve reached the free message limit for this bot. To unlock a full setup on
                your own infrastructure, get in touch.
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href="mailto:you@example.com?subject=Assistrio%20AI%20bot%20upgrade"
                  className="inline-flex"
                >
                  <Button size="sm" variant="primary">
                    Contact us
                  </Button>
                </a>
              </div>
            </Card>
          </div>
        )}

        {error && <p className="text-xs text-red-400 mb-1">{error}</p>}

        <div
          className={cx("border-t pt-3", bot.chatUI?.backgroundStyle === "light" ? "border-slate-200" : "border-slate-800")}
        >
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={limitReached ? "Free limit reached." : "Type your message..."}
              disabled={loading || limitReached}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={sendDisabled}
            >
              {loading ? "Sending..." : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
