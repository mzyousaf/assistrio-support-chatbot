export type TrialCreateAgentApiResult = {
  ok: true;
  alreadyCreated?: boolean;
  draft: unknown;
  bot: { id: string; slug: string; accessKey: string; name: string };
};

export async function fetchTrialCreateAgent(): Promise<TrialCreateAgentApiResult> {
  const res = await fetch("/api/trial/create-agent", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : "Could not create your AI Agent.";
    throw new Error(msg);
  }
  if (j.ok !== true || j.draft == null) {
    throw new Error("Unexpected response from server.");
  }
  return j as unknown as TrialCreateAgentApiResult;
}
