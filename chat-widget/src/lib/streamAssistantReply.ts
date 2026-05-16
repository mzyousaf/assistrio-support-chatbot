import type { Dispatch, SetStateAction } from "react";

import type { ChatUIMessage, ChatUIMessageStatus } from "../components/chat-ui/types";

/** Target pacing: steady characters per second (linear over wall time). */
const MS_PER_CHAR = 28;
const MIN_DURATION_MS = 1_200;
const MAX_DURATION_MS = 18_000;

export type StreamAssistantReplyOptions = {
  /** Applied when the full text has been revealed (default `sent`; use `error` for failed API bodies). */
  finalStatus?: ChatUIMessageStatus;
};

/**
 * Reveal assistant text incrementally after the HTTP response completes (client-side “streaming” UX).
 * Linear progress for consistent typing speed; updates on rAF.
 */
export function streamAssistantReply(
  assistantId: string,
  fullText: string,
  setMessages: Dispatch<SetStateAction<ChatUIMessage[]>>,
  options?: StreamAssistantReplyOptions,
): Promise<void> {
  const finalStatus: ChatUIMessageStatus = options?.finalStatus ?? "sent";

  if (!fullText.length) {
    const createdAt = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: "", status: finalStatus, createdAt }
          : m,
      ),
    );
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const durationMs = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, fullText.length * MS_PER_CHAR),
    );
    const start = performance.now();
    let lastRenderedLength = -1;

    const frame = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const i = t >= 1 ? fullText.length : Math.floor(t * fullText.length);

      if (i !== lastRenderedLength) {
        lastRenderedLength = i;
        const done = i >= fullText.length;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: fullText.slice(0, i),
                  status: (done ? finalStatus : "streaming") as ChatUIMessageStatus,
                  ...(done ? { createdAt: new Date().toISOString() } : {}),
                }
              : m,
          ),
        );
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(frame);
  });
}
