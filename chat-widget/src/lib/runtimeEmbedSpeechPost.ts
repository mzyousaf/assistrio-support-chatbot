/**
 * Runtime embed speech: multipart POST with session cookie; retry once with access/secret in form fields (mirrors runtimeEmbedPost).
 */
export async function runtimeEmbedSpeechPost(
  url: string,
  buildForm: (includeKeys: boolean) => FormData,
  keys: { accessKey?: string; secretKey?: string },
): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    body: buildForm(false),
    credentials: "include",
  });
  if (res.ok || res.status !== 403) return res;
  const data = (await res.clone().json().catch(() => ({}))) as { errorCode?: string };
  const code = typeof data.errorCode === "string" ? data.errorCode : "";
  if (code !== "INVALID_ACCESS_KEY" && code !== "INVALID_SECRET_KEY") return res;
  if (!keys.accessKey && !keys.secretKey) return res;
  return fetch(url, {
    method: "POST",
    body: buildForm(true),
    credentials: "include",
  });
}
