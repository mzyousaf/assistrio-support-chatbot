/**
 * Browser-safe trial onboarding draft API (same-origin Next routes → Nest with `X-API-Key`).
 */

export type TrialDraftApiError = {
  ok: false;
  status: number;
  errorMessage: string;
  errorCode?: string;
};

export type TrialDraftGetSuccess = {
  ok: true;
  draft: unknown;
};

export type TrialDraftPatchSuccess = {
  ok: true;
  draft: unknown;
};

function readErrorMessage(json: Record<string, unknown>): string {
  if (typeof json.error === "string" && json.error.trim()) return json.error.trim();
  if (typeof json.message === "string" && json.message.trim()) return json.message.trim();
  return "Something went wrong while saving.";
}

export async function fetchTrialWorkspaceDraft(): Promise<TrialDraftGetSuccess | TrialDraftApiError> {
  const res = await fetch("/api/trial/draft", {
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
  if (json.ok !== true || !("draft" in json)) {
    return {
      ok: false,
      status: res.status,
      errorMessage: "Unexpected response from server.",
    };
  }
  return { ok: true, draft: json.draft };
}

export async function patchTrialWorkspaceDraft(body: unknown): Promise<TrialDraftPatchSuccess | TrialDraftApiError> {
  const res = await fetch("/api/trial/draft", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
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
  if (json.ok !== true || !("draft" in json)) {
    return {
      ok: false,
      status: res.status,
      errorMessage: "Unexpected response from server.",
    };
  }
  return { ok: true, draft: json.draft };
}
