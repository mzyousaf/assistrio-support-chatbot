"use client";

import { FormEvent, useMemo, useState } from "react";

import { useVisitorId } from "@/hooks/useVisitorId";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

interface TrialChatClientProps {
  botSlug: string;
  botName: string;
}

export default function TrialChatClient({
  botSlug,
  botName,
}: TrialChatClientProps) {
  const { visitorId, loading: visitorLoading } = useVisitorId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendDisabled = useMemo(
    () => loading || visitorLoading || !visitorId || !input.trim(),
    [loading, visitorLoading, visitorId, input],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const inputValue = input.trim();
    if (!inputValue || !visitorId || loading) {
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: inputValue }]);
    setLoading(true);

    try {
      const response = await fetch("/api/trial/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botSlug,
          message: inputValue,
          visitorId,
        }),
      });

      const data = (await response.json()) as
        | { reply?: string; error?: string; message?: string }
        | undefined;

      if (response.status === 403 && data?.error === "limit_reached") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.message ?? "You reached the usage limit for your trial bot.",
          },
        ]);
        return;
      }

      const reply = data?.reply;
      if (!response.ok || typeof reply !== "string") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Something went wrong. Please try again.",
          },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error. Please check your connection and retry.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (visitorLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
        <p className="text-sm text-zinc-300">Initializing session...</p>
      </main>
    );
  }

  if (!visitorId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
        <p className="text-sm text-red-300">Unable to create visitor session.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold">{botName}</h1>
        <p className="text-sm text-zinc-400">Your trial bot - free limited messages.</p>
        <p className="mt-1 text-xs text-zinc-500">
          You can test up to the free message limit. Contact us to upgrade.
        </p>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            Start the conversation by sending your first message.
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </section>

      <footer className="border-t border-zinc-800 bg-zinc-950/90 px-4 py-4 sm:px-6">
        <form className="mx-auto flex w-full max-w-3xl gap-3" onSubmit={onSubmit}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={sendDisabled}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </footer>
    </main>
  );
}
