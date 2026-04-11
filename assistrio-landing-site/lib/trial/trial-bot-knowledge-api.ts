/**
 * Browser-safe: same-origin Next route proxies to Nest with landing API key + session cookie.
 */

export type TrialBotKnowledgeDocumentRow = {
  id: string;
  title: string;
  fileName?: string;
  status?: string;
  error?: string;
  active: boolean;
  createdAt?: string;
};

export type TrialBotKnowledgeSummary = {
  ok: true;
  botId: string;
  documents: TrialBotKnowledgeDocumentRow[];
  documentCounts: {
    docsTotal: number;
    docsQueued: number;
    docsProcessing: number;
    docsReady: number;
    docsFailed: number;
    lastIngestedAt?: string;
    lastFailedDoc?: { docId: string; title: string; error: string; updatedAt?: string };
  };
  faqs: Array<{ question: string; answer: string }>;
  note: { present: boolean; length: number; preview: string };
};

export type TrialBotKnowledgeApiError = {
  ok: false;
  status: number;
  errorMessage: string;
  errorCode?: string;
};

function readErrorMessage(json: Record<string, unknown>): string {
  if (typeof json.error === "string" && json.error.trim()) return json.error.trim();
  if (typeof json.message === "string" && json.message.trim()) return json.message.trim();
  return "Could not load knowledge status.";
}

export async function fetchTrialBotKnowledgeSummary(): Promise<TrialBotKnowledgeSummary | TrialBotKnowledgeApiError> {
  const res = await fetch("/api/trial/bot-knowledge", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      errorMessage: readErrorMessage(json),
      errorCode: typeof json.errorCode === "string" ? json.errorCode : undefined,
    };
  }
  if (json.ok !== true || typeof json.botId !== "string") {
    return {
      ok: false,
      status: res.status,
      errorMessage: "Unexpected response from server.",
    };
  }
  return json as unknown as TrialBotKnowledgeSummary;
}

export type TrialBotKnowledgeRetrySuccess = { ok: true; documentId: string };

export async function retryTrialBotFailedDocument(
  documentId: string,
): Promise<TrialBotKnowledgeRetrySuccess | TrialBotKnowledgeApiError> {
  const res = await fetch("/api/trial/bot-knowledge/retry", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ documentId }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      errorMessage: readErrorMessage(json),
      errorCode: typeof json.errorCode === "string" ? json.errorCode : undefined,
    };
  }
  if (json.ok !== true || typeof json.documentId !== "string") {
    return {
      ok: false,
      status: res.status,
      errorMessage: "Unexpected response from server.",
    };
  }
  return { ok: true, documentId: json.documentId };
}
