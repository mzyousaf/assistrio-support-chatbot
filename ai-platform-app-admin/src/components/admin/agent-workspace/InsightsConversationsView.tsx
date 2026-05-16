"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAgentWorkspace } from "@/contexts/AgentWorkspaceContext";
import { Filter, MessageSquare, RefreshCw } from "lucide-react";

type ConversationRow = {
  id: string;
  lastActivityAt: string;
  chatVisitorId: string;
  userPreview: string;
  assistantPreview: string;
};

type MessageRow = {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

function relTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function InsightsConversationsView() {
  const { botId } = useAgentWorkspace();
  const [list, setList] = useState<ConversationRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listState, setListState] = useState<"loading" | "ok" | "error">("loading");
  const [listErr, setListErr] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [msgState, setMsgState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msgErr, setMsgErr] = useState("");
  const [rightTab, setRightTab] = useState<"chat" | "details">("chat");

  // Initial load: reset cursor
  const refresh = useCallback(async () => {
    setNextCursor(null);
    setList([]);
    if (!botId) return;
    setListState("loading");
    setListErr("");
    const params = new URLSearchParams();
    params.set("limit", "40");
    const res = await apiFetch(
      `/api/admin/bots/${encodeURIComponent(botId)}/conversations?${params.toString()}`,
    );
    if (!res.ok) {
      setListState("error");
      setListErr("Could not load chat logs.");
      return;
    }
    const data = (await res.json()) as {
      conversations: ConversationRow[];
      nextCursor: string | null;
    };
    setList(data.conversations);
    setNextCursor(data.nextCursor);
    setListState("ok");
    const first = data.conversations[0];
    if (first) {
      setSelectedId(first.id);
    } else {
      setSelectedId(null);
      setMessages(null);
    }
  }, [botId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!botId || !nextCursor) return;
    setListErr("");
    const params = new URLSearchParams();
    params.set("limit", "40");
    params.set("before", nextCursor);
    const res = await apiFetch(
      `/api/admin/bots/${encodeURIComponent(botId)}/conversations?${params.toString()}`,
    );
    if (!res.ok) {
      setListErr("Could not load more.");
      return;
    }
    const data = (await res.json()) as {
      conversations: ConversationRow[];
      nextCursor: string | null;
    };
    setList((prev) => [...prev, ...data.conversations]);
    setNextCursor(data.nextCursor);
  }, [botId, nextCursor]);

  useEffect(() => {
    if (!botId || !selectedId) {
      setMessages(null);
      return;
    }
    let cancelled = false;
    setMsgState("loading");
    setMsgErr("");
    void (async () => {
      const res = await apiFetch(
        `/api/admin/bots/${encodeURIComponent(botId)}/conversations/${encodeURIComponent(
          selectedId,
        )}/messages`,
      );
      if (cancelled) return;
      if (!res.ok) {
        setMsgState("error");
        setMsgErr("Could not load messages.");
        setMessages(null);
        return;
      }
      const body = (await res.json()) as { ok: boolean; messages: MessageRow[] };
      setMessages(body.messages);
      setMsgState("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [botId, selectedId]);

  const selected = list.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-none flex-1 flex-col">
    <div className="flex min-h-0 h-full w-full min-w-0 max-w-none flex-1 flex-col gap-0 overflow-hidden border-0 border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/30 md:flex-row">
      <div
        className="flex w-full min-h-0 min-h-[32vh] max-h-[50vh] shrink-0 flex-col border-b border-slate-200/80 max-md:max-h-[50vh] dark:border-slate-800 md:max-h-none md:min-h-0 md:w-[35%] md:shrink-0 md:border-b-0 md:border-r"
        style={{ background: "oklch(98.5% 0 0)" }}
      >
        <div className="flex min-h-[4.75rem] shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 px-3 py-2.5 sm:min-h-[5.25rem] sm:px-3.5 sm:py-3 dark:border-slate-800">
          <h2 className="m-0 min-w-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
            Chat logs
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-teal-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50"
              title="Filter"
              aria-label="Filter chat logs"
            >
              <Filter size={15} className="text-teal-600" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-teal-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/50"
              title="Refresh"
              aria-label="Refresh chat logs"
            >
              <RefreshCw
                size={15}
                className={listState === "loading" ? "animate-spin text-teal-600" : "text-teal-600"}
                strokeWidth={2}
              />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {listState === "error" && (
            <p className="m-0 px-1 text-sm text-red-600 dark:text-red-400">{listErr}</p>
          )}
          {listState === "ok" && list.length === 0 && (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-8 text-center"
              role="status"
              aria-label="No chats"
            >
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm"
                aria-hidden
              >
                <MessageSquare className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">No chats found</p>
              <p className="m-0 mt-2 max-w-[20rem] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Try adjusting your filters or check back later for new conversations.
              </p>
            </div>
          )}
          {list.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={
                  active
                    ? "mb-1.5 w-full rounded-lg border border-teal-500/80 bg-white px-2.5 py-2 text-left text-sm shadow-sm transition dark:border-teal-600/50 dark:bg-slate-900"
                    : "mb-1.5 w-full rounded-lg border border-transparent bg-transparent px-2.5 py-2 text-left text-sm transition hover:border-slate-200 hover:bg-white/80 dark:hover:border-slate-700 dark:hover:bg-slate-900/50"
                }
              >
                <p className="m-0 line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">
                  {c.assistantPreview || "—"}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                  {c.userPreview || "No user messages"}
                </p>
                <p className="mt-1 text-right text-[11px] text-slate-400">{relTime(c.lastActivityAt)}</p>
              </button>
            );
          })}
          {listState === "ok" && nextCursor && (
            <button
              type="button"
              className="mt-1 w-full rounded-md py-2 text-center text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
              onClick={() => void loadMore()}
            >
              Load more
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-h-[40vh] w-full flex-1 flex-col overflow-hidden bg-white max-md:min-h-[50vh] md:min-h-0 md:w-[65%]">
        {!selected ? (
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center"
            role="status"
          >
            <p className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">Select a conversation</p>
            <p className="m-0 mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Choose a conversation from the list to view its details and messages.
            </p>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-200/60 dark:border-slate-800">
              <div className="mb-4 flex min-h-[4.75rem] items-center px-4 py-2.5 sm:mb-5 sm:min-h-[5.25rem] sm:py-3">
                <h2 className="m-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                  Playground
                </h2>
              </div>
              <div
                className="flex items-end justify-start gap-6 border-b border-slate-200/60 px-4 dark:border-slate-800"
                role="tablist"
                aria-label="Playground: Chat and Details"
              >
                {(["chat", "details"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={rightTab === tab}
                    onClick={() => setRightTab(tab)}
                    className={
                      rightTab === tab
                        ? "-mb-px inline-flex shrink-0 border-b-2 border-teal-600 px-0.5 pb-2.5 pt-1 text-sm font-medium text-slate-900 dark:border-teal-500 dark:text-slate-100"
                        : "-mb-px inline-flex shrink-0 border-b-2 border-transparent px-0.5 pb-2.5 pt-1 text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }
                  >
                    {tab === "chat" ? "Chat" : "Details"}
                  </button>
                ))}
              </div>
            </div>
            {rightTab === "chat" && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {msgState === "loading" && <p className="m-0 text-sm text-slate-500">Loading messages…</p>}
                {msgState === "error" && <p className="m-0 text-sm text-red-600 dark:text-red-400">{msgErr}</p>}
                {msgState === "ok" &&
                  messages &&
                  messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div
                        key={`${m.createdAt}-${m.role}-${m.content.slice(0, 20)}`}
                        className={`mb-3 flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={
                            isUser
                              ? "max-w-[min(100%,32rem)] rounded-2xl bg-slate-900 px-3 py-2 text-sm leading-relaxed text-white dark:bg-slate-100 dark:text-slate-900"
                              : "max-w-[min(100%,32rem)] rounded-2xl bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                          }
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            {rightTab === "details" && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                <dl className="m-0 space-y-3">
                  <div>
                    <dt className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Conversation</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-slate-800 dark:text-slate-200">
                      {selected.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Chat visitor</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-slate-800 dark:text-slate-200">
                      {selected.chatVisitorId || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Last activity</dt>
                    <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                      {relTime(selected.lastActivityAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </div>
  );
}
