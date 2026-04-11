/**
 * Trial Playground: created bot as source of truth (BFF → Nest with session cookie).
 */

export type TrialWorkspaceAgentProfile = {
  name: string;
  categories: string[];
  imageUrl: string;
  brandColor: string;
  quickLinks: Array<{ text: string; route: string; icon?: string }>;
  slug: string;
  allowedDomains: string[];
  includeNameInKnowledge: boolean;
  avatarEmoji: string;
};

export type TrialWorkspaceAgentBehavior = {
  shortDescription: string;
  description: string;
  welcomeMessage: string;
  exampleQuestions: string[];
  personality: { systemPrompt: string; behaviorPreset: string; tone: string; thingsToAvoid?: string };
  leadCapture: Record<string, unknown>;
};

export type TrialWorkspaceAgentKnowledge = {
  notes: string;
  faqs: Array<{ question: string; answer: string }>;
};

export type TrialWorkspaceAgentPayload = {
  ok: true;
  botId: string;
  profile: TrialWorkspaceAgentProfile;
  behavior: TrialWorkspaceAgentBehavior;
  knowledge: TrialWorkspaceAgentKnowledge;
};

export type TrialWorkspaceAgentApiError = {
  ok: false;
  status: number;
  errorMessage: string;
  errorCode?: string;
};

function readErrorMessage(json: Record<string, unknown>): string {
  if (typeof json.error === "string" && json.error.trim()) return json.error.trim();
  if (typeof json.message === "string" && json.message.trim()) return json.message.trim();
  return "Something went wrong.";
}

export async function fetchTrialWorkspaceAgent(): Promise<TrialWorkspaceAgentPayload | TrialWorkspaceAgentApiError> {
  const res = await fetch("/api/trial/agent", {
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
    return { ok: false, status: res.status, errorMessage: "Unexpected response from server." };
  }
  return json as unknown as TrialWorkspaceAgentPayload;
}

export async function patchTrialWorkspaceProfile(
  body: Record<string, unknown>,
): Promise<TrialWorkspaceAgentPayload | TrialWorkspaceAgentApiError> {
  const res = await fetch("/api/trial/agent/profile", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  if (json.ok !== true) {
    return { ok: false, status: res.status, errorMessage: "Unexpected response from server." };
  }
  return json as unknown as TrialWorkspaceAgentPayload;
}

export async function patchTrialWorkspaceBehavior(
  body: Record<string, unknown>,
): Promise<TrialWorkspaceAgentPayload | TrialWorkspaceAgentApiError> {
  const res = await fetch("/api/trial/agent/behavior", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  if (json.ok !== true) {
    return { ok: false, status: res.status, errorMessage: "Unexpected response from server." };
  }
  return json as unknown as TrialWorkspaceAgentPayload;
}

export async function patchTrialWorkspaceKnowledge(
  body: Record<string, unknown>,
): Promise<TrialWorkspaceAgentPayload | TrialWorkspaceAgentApiError> {
  const res = await fetch("/api/trial/agent/knowledge", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  if (json.ok !== true) {
    return { ok: false, status: res.status, errorMessage: "Unexpected response from server." };
  }
  return json as unknown as TrialWorkspaceAgentPayload;
}
