"use client";

import React, { useCallback, useState } from "react";

import { ChatWithLauncher, mapSources } from "@/components/chat-ui";
import type { ChatUIMessage, ChatUISource } from "@/components/chat-ui";
import { apiFetch } from "@/lib/api";

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Demo page for the chat-ui Chat component.
 * Uses /api/chat-demo for echo-style responses.
 */
export default function ChatDemoPage() {
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const onSend = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value || isSending) return;

    const userMsg: ChatUIMessage = {
      id: generateId(),
      role: "user",
      content: value,
      createdAt: isoNow(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const res = await apiFetch("/api/chat-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: value }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        assistantMessage?: string;
        sources?: ChatUISource[];
        error?: string;
      };
      const content = data.assistantMessage ?? data.error ?? "No response.";
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content,
          createdAt: isoNow(),
          sources: mapSources(data.sources),
          status: res.ok ? "sent" : "error",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: "Network error.",
          createdAt: isoNow(),
          status: "error",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [isSending]);

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Chat component demo
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Uses the chat-ui Chat component with /api/chat-demo (echo).
          </p>
        </header>

        <section className="flex justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use the chat bubble in the bottom-right corner to open and close the chat.
          </p>
        </section>

        <ChatWithLauncher
          dark
          accentColor="#14B8A6"
          bubbleBorderRadius={20}
          showHeader
          showFooter
          showSuggestedChips
          avatar={<span aria-hidden>💬</span>}
          title="Live Chat"
          subtitle="Echo demo"
          messages={messages}
          isSending={isSending}
          onSend={onSend}
          showMetadata
          showCopyButton
          showSources
          allowMarkdown
          suggestedQuestions={["What can you do?", "Tell me more.", "How does this work?"]}
          privacyText="Demo only. Conversations are not stored."
          strings={{
            placeholder: "Type a message…",
            send: "Send",
            copy: "Copy",
            copied: "Copied!",
            sourcesLabel: "Sources",
          }}
          showAttach={false}
          showEmoji={false}
          showMic={false}
          onAttach={() => {}}
          onEmoji={() => {}}
          onMic={() => {}}
          launcherPosition="bottom-right"
        />
      </div>
    </main>
  );
}
