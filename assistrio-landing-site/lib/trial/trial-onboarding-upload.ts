/**
 * Same-origin uploads → Nest → S3; merged into onboarding draft on the server.
 */

export async function uploadTrialOnboardingAsset(
  kind: "avatar" | "knowledge_document",
  file: File,
): Promise<{ draft: unknown }> {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file);
  const res = await fetch("/api/trial/onboarding/upload", {
    method: "POST",
    body: fd,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : "Upload failed.";
    const code = typeof j.errorCode === "string" ? j.errorCode : "";
    throw new Error(code ? `${code}: ${msg}` : msg);
  }
  if (j.ok !== true || j.draft == null) {
    throw new Error("Unexpected upload response.");
  }
  return { draft: j.draft };
}
